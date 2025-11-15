import { cache, Types } from '@cornerstonejs/core';
import { utilities } from '@cornerstonejs/tools';
// import { VolumeViewport } from '@cornerstonejs/core'; // optional, not required here

function _getVolumeFromViewport(viewport: Types.IBaseVolumeViewport | any) {
  if (!viewport || typeof viewport.getAllVolumeIds !== 'function') {
    return null;
  }

  // During teardown this can be [], and cache.getVolume(...) can return undefined
  const volumeIds: string[] = viewport.getAllVolumeIds?.() ?? [];
  if (!Array.isArray(volumeIds) || volumeIds.length === 0) {
    return null;
  }

  const volumes = volumeIds
    .map(id => {
      try {
        return cache.getVolume(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as any[];

  if (volumes.length === 0) {
    return null;
  }

  // Prefer a dynamic volume if available, but don’t assume the method exists
  const dynamicVolume = volumes.find(v => {
    const fn = (v as any)?.isDynamicVolume;
    return typeof fn === 'function' ? !!fn.call(v) : false;
  });

  return dynamicVolume ?? volumes[0] ?? null;
}

/**
 * Return all viewports that need to be synchronized with the source viewport
 * when cine is updated. Safe during MPR teardown/rebuild.
 */
function _getSyncedViewports(servicesManager: AppTypes.ServicesManager, srcViewportId: string) {
  const { viewportGridService, cornerstoneViewportService } = servicesManager.services;

  const gridState = viewportGridService.getState?.();
  const viewportsStates: Map<string, any> = gridState?.viewports ?? new Map();

  const srcViewportState = viewportsStates.get(srcViewportId);
  if (srcViewportState?.viewportOptions?.viewportType !== 'volume') {
    return [];
  }

  const srcViewport = cornerstoneViewportService.getCornerstoneViewport?.(srcViewportId);
  if (!srcViewport) {
    // Between teardown and rebuild
    return [];
  }

  const srcVolume = _getVolumeFromViewport(srcViewport);
  if (!srcVolume) {
    return [];
  }

  // Only sync dynamic time volumes; if method doesn’t exist, treat as non-dynamic
  const isDynamic =
    typeof (srcVolume as any).isDynamicVolume === 'function'
      ? (srcVolume as any).isDynamicVolume()
      : false;
  if (!isDynamic) {
    return [];
  }

  const srcVolumeId =
    (srcVolume as any).volumeId ?? (srcVolume as any).id ?? (srcVolume as any)._volumeId;
  if (!srcVolumeId) {
    return [];
  }

  // Collect viewports that actually reference the same volume ID
  const synced = [];
  for (const vpState of viewportsStates.values()) {
    const { viewportId } = vpState ?? {};
    if (!viewportId || viewportId === srcViewportId) {
      continue;
    }

    const vp = cornerstoneViewportService.getCornerstoneViewport?.(viewportId);
    const hasSame =
      vp && typeof (vp as any).hasVolumeId === 'function' && (vp as any).hasVolumeId(srcVolumeId);

    if (hasSame) {
      synced.push({ viewportId });
    }
  }

  return synced;
}

function initCineService(servicesManager: AppTypes.ServicesManager) {
  const { cineService } = servicesManager.services;

  const getSyncedViewports = (viewportId: string) => {
    try {
      return _getSyncedViewports(servicesManager, viewportId) ?? [];
    } catch {
      // If something is mid-destroy, fail soft
      return [];
    }
  };

  const playClip = (element, playClipOptions) => {
    return utilities.cine.playClip(element, playClipOptions);
  };

  const stopClip = (element, stopClipOptions) => {
    return utilities.cine.stopClip(element, stopClipOptions);
  };

  cineService.setServiceImplementation({
    getSyncedViewports,
    playClip,
    stopClip,
  });
}

export default initCineService;
