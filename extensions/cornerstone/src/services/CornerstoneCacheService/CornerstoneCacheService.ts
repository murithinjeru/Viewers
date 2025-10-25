import { Types } from '@ohif/core';
import {
  cache as cs3DCache,
  Enums,
  volumeLoader,
  imageLoader, // ⬅️ add
  requestPoolManager, // ⬅️ optional, for prefetch request type tagging
} from '@cornerstonejs/core';

import getCornerstoneViewportType from '../../utils/getCornerstoneViewportType';
import { StackViewportData, VolumeViewportData } from '../../types/CornerstoneCacheService';
import { VOLUME_LOADER_SCHEME } from '../../constants';

class CornerstoneCacheService {
  static REGISTRATION = {
    name: 'cornerstoneCacheService',
    altName: 'CornerstoneCacheService',
    create: ({ servicesManager }: Types.Extensions.ExtensionParams): CornerstoneCacheService => {
      return new CornerstoneCacheService(servicesManager);
    },
  };

  // 👇 add a feature flag (can be wired to your app config if desired)
  private readonly eagerPixelData = true;

  stackImageIds: Map<string, string[]> = new Map();
  volumeImageIds: Map<string, string[]> = new Map();
  readonly servicesManager: AppTypes.ServicesManager;

  constructor(servicesManager: AppTypes.ServicesManager) {
    this.servicesManager = servicesManager;
  }

  public getCacheSize() {
    return cs3DCache.getCacheSize();
  }

  public getCacheFreeSpace() {
    return cs3DCache.getBytesAvailable();
  }

  public async createViewportData(
    displaySets: Types.DisplaySet[],
    viewportOptions: AppTypes.ViewportGrid.GridViewportOptions,
    dataSource: unknown,
    initialImageIndex?: number
  ): Promise<StackViewportData | VolumeViewportData> {
    const viewportType = viewportOptions.viewportType as string;

    const cs3DViewportType = getCornerstoneViewportType(viewportType, displaySets);
    let viewportData: StackViewportData | VolumeViewportData;

    if (
      cs3DViewportType === Enums.ViewportType.ORTHOGRAPHIC ||
      cs3DViewportType === Enums.ViewportType.VOLUME_3D
    ) {
      viewportData = await this._getVolumeViewportData(dataSource, displaySets, cs3DViewportType);
    } else if (cs3DViewportType === Enums.ViewportType.STACK) {
      viewportData = await this._getStackViewportData(
        dataSource,
        displaySets,
        initialImageIndex,
        cs3DViewportType
      );
    } else {
      viewportData = await this._getOtherViewportData(
        dataSource,
        displaySets,
        initialImageIndex,
        cs3DViewportType
      );
    }

    viewportData.viewportType = cs3DViewportType;

    return viewportData;
  }

  public async invalidateViewportData(
    viewportData: VolumeViewportData | StackViewportData,
    invalidatedDisplaySetInstanceUID: string,
    dataSource,
    displaySetService
  ): Promise<VolumeViewportData | StackViewportData> {
    if (viewportData.viewportType === Enums.ViewportType.STACK) {
      const displaySet = displaySetService.getDisplaySetByUID(invalidatedDisplaySetInstanceUID);
      const imageIds = this._getCornerstoneStackImageIds(displaySet, dataSource);

      imageIds.forEach(imageId => {
        if (cs3DCache.getImageLoadObject(imageId)) {
          cs3DCache.removeImageLoadObject(imageId);
        }
      });

      // re-eager-load if enabled
      if (this.eagerPixelData && imageIds?.length) {
        await this._eagerlyCacheStack(imageIds);
      }

      return {
        viewportType: Enums.ViewportType.STACK,
        data: {
          StudyInstanceUID: displaySet.StudyInstanceUID,
          displaySetInstanceUID: invalidatedDisplaySetInstanceUID,
          imageIds,
        },
      };
    }

    const volumeId = `${VOLUME_LOADER_SCHEME}:${invalidatedDisplaySetInstanceUID}`;
    const volume = cs3DCache.getVolume(volumeId);

    if (volume) {
      if (volume.imageIds) {
        volume.imageIds.forEach(imageId => {
          if (cs3DCache.getImageLoadObject(imageId)) {
            cs3DCache.removeImageLoadObject(imageId, { force: true });
          }
        });
      }
      cs3DCache._volumeCache.delete(volumeId);
      this.volumeImageIds.delete(volumeId);
    }

    const displaySets = viewportData.data.map(({ displaySetInstanceUID }) =>
      displaySetService.getDisplaySetByUID(displaySetInstanceUID)
    );

    const newViewportData = await this._getVolumeViewportData(
      dataSource,
      displaySets,
      viewportData.viewportType
    );

    return newViewportData;
  }

  private async _getOtherViewportData(
    dataSource,
    displaySets,
    _initialImageIndex,
    viewportType: Enums.ViewportType
  ): Promise<StackViewportData> {
    const [displaySet] = displaySets;
    if (!displaySet.imageIds) {
      displaySet.imagesIds = this._getCornerstoneStackImageIds(displaySet, dataSource);
    }
    // 🔽 optional eager load for "other" viewports using stack semantics
    if (this.eagerPixelData && displaySet.imageIds?.length) {
      await this._eagerlyCacheStack(displaySet.imageIds);
    }
    const { imageIds: data, viewportType: dsViewportType } = displaySet;
    return {
      viewportType: dsViewportType || viewportType,
      data: displaySets,
    };
  }

  private async _getStackViewportData(
    dataSource,
    displaySets,
    initialImageIndex,
    viewportType: Enums.ViewportType
  ): Promise<StackViewportData> {
    const { uiNotificationService } = this.servicesManager.services;
    const overlayDisplaySets = displaySets.filter(ds => ds.isOverlayDisplaySet);
    for (const overlayDisplaySet of overlayDisplaySets) {
      if (overlayDisplaySet.load && overlayDisplaySet.load instanceof Function) {
        const { userAuthenticationService } = this.servicesManager.services;
        const headers = userAuthenticationService.getAuthorizationHeader();
        try {
          await overlayDisplaySet.load({ headers });
        } catch (e) {
          uiNotificationService.show({
            title: 'Error loading displaySet',
            message: e.message,
            type: 'error',
          });
          console.error(e);
        }
      }
    }

    const StackViewportData = [];
    for (const displaySet of displaySets) {
      const { displaySetInstanceUID, StudyInstanceUID, isCompositeStack } = displaySet;

      if (displaySet.load && displaySet.load instanceof Function) {
        const { userAuthenticationService } = this.servicesManager.services;
        const headers = userAuthenticationService.getAuthorizationHeader();
        try {
          await displaySet.load({ headers });
        } catch (e) {
          uiNotificationService.show({
            title: 'Error loading displaySet',
            message: e.message,
            type: 'error',
          });
          console.error(e);
        }
      }

      let stackImageIds = this.stackImageIds.get(displaySet.displaySetInstanceUID);

      if (!stackImageIds) {
        stackImageIds = this._getCornerstoneStackImageIds(displaySet, dataSource);
        displaySet.imageIds = stackImageIds;
        this.stackImageIds.set(displaySet.displaySetInstanceUID, stackImageIds);
      }

      // ⬇️ eagerly fetch & cache all frames for the stack
      if (this.eagerPixelData && stackImageIds?.length) {
        await this._eagerlyCacheStack(stackImageIds);
      }

      StackViewportData.push({
        StudyInstanceUID,
        displaySetInstanceUID,
        isCompositeStack,
        imageIds: stackImageIds,
        initialImageIndex,
      });
    }

    return {
      viewportType,
      data: StackViewportData,
    };
  }

  private async _getVolumeViewportData(
    dataSource,
    displaySets,
    viewportType: Enums.ViewportType
  ): Promise<VolumeViewportData> {
    const volumeData = [];

    for (const displaySet of displaySets) {
      const { Modality } = displaySet;
      const isParametricMap = Modality === 'PMAP';
      const isSeg = Modality === 'SEG';

      if (displaySet.load && displaySet.load instanceof Function) {
        const { userAuthenticationService } = this.servicesManager.services;
        const headers = userAuthenticationService.getAuthorizationHeader();

        try {
          await displaySet.load({ headers });
        } catch (e) {
          const { uiNotificationService } = this.servicesManager.services;
          uiNotificationService.show({
            title: 'Error loading displaySet',
            message: e.message,
            type: 'error',
          });
          console.error(e);
        }

        if (!isParametricMap) {
          volumeData.push({
            studyInstanceUID: displaySet.StudyInstanceUID,
            displaySetInstanceUID: displaySet.displaySetInstanceUID,
          });
          continue;
        }
      }

      const volumeLoaderSchema = displaySet.volumeLoaderSchema ?? VOLUME_LOADER_SCHEME;
      const volumeId = `${volumeLoaderSchema}:${displaySet.displaySetInstanceUID}`;
      let volumeImageIds = this.volumeImageIds.get(displaySet.displaySetInstanceUID);
      let volume = cs3DCache.getVolume(volumeId);

      if (!isParametricMap && !isSeg && (!volumeImageIds || !volume)) {
        volumeImageIds = this._getCornerstoneVolumeImageIds(displaySet, dataSource);

        volume = await volumeLoader.createAndCacheVolume(volumeId, {
          imageIds: volumeImageIds,
        });

        // ⬇️ eagerly stream the full volume (fills the 3D array & caches)
        if (this.eagerPixelData && volume?.load) {
          await this._eagerlyLoadVolume(volume);
        }

        this.volumeImageIds.set(displaySet.displaySetInstanceUID, volumeImageIds);
        displaySet.imageIds = volumeImageIds;
      }

      volumeData.push({
        StudyInstanceUID: displaySet.StudyInstanceUID,
        displaySetInstanceUID: displaySet.displaySetInstanceUID,
        volume,
        volumeId,
        imageIds: volumeImageIds,
        isDynamicVolume: displaySet.isDynamicVolume,
      });
    }

    return {
      viewportType,
      data: volumeData,
    };
  }

  private _getCornerstoneStackImageIds(displaySet, dataSource): string[] {
    return dataSource.getImageIdsForDisplaySet(displaySet);
  }

  private _getCornerstoneVolumeImageIds(displaySet, dataSource): string[] {
    if (displaySet.imageIds) {
      return displaySet.imageIds;
    }
    const stackImageIds = this._getCornerstoneStackImageIds(displaySet, dataSource);
    return stackImageIds;
  }

  // ==== NEW HELPERS =========================================================

  /**
   * Eagerly loads & caches all images for a stack.
   * Uses the 'prefetch' request type so it doesn't starve user interactions.
   */
  private async _eagerlyCacheStack(imageIds: string[]) {
    // Cornerstone helper loads & caches a list of imageIds
    // (returns an array of Promises we can await in parallel)
    const promises = imageLoader.loadAndCacheImages(imageIds, {
      // Mark these as prefetch so RequestPool can prioritize user actions
      requestType: 'prefetch',
    } as any);
    await Promise.allSettled(promises);
  }

  /**
   * Eagerly loads the full streaming volume.
   */
  private async _eagerlyLoadVolume(volume: any) {
    // StreamingImageVolume implements .load(), which schedules all frame requests.
    await volume.load();
  }
}

export default CornerstoneCacheService;
