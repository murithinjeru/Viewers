// LeftRailToolbarPanel.tsx
import React, { useEffect, useState } from 'react';
import Toolbar from './Toolbar/Toolbar'; // your copied Toolbar file

export default function LeftRailToolbarPanel({ servicesManager }: { servicesManager?: any }) {
  if (!servicesManager || !servicesManager.services) {
    return <div style={{ padding: 8 }}>Toolbar not ready</div>;
  }

  const { toolbarService, viewportGridService, toolGroupService } = servicesManager.services;

  const [activeViewportId, setActiveViewportId] = useState<string | null>(
    viewportGridService?.getActiveViewportId?.() ?? null
  );

  // utility to compute current toolGroup (best-effort; method names vary across builds)
  const getToolGroup = (viewportId: string | null) => {
    if (!viewportId) {
      return undefined;
    }
    if (toolGroupService?.getToolGroupForViewport) {
      return toolGroupService.getToolGroupForViewport(viewportId);
    }
    if (toolGroupService?.getToolGroup) {
      return toolGroupService.getToolGroup(viewportId);
    }
    // fallback: maybe toolGroup is stored on viewport options (best-effort)
    try {
      const vpInfo =
        servicesManager.services.cornerstoneViewportService?.getViewportInfo?.(viewportId);
      return vpInfo?.getToolGroupId?.() ?? undefined;
    } catch (e) {
      return undefined;
    }
  };

  // Ensure ToolbarService knows the viewport + toolGroup (calls refreshToolbarState)
  useEffect(() => {
    if (!toolbarService) {
      return;
    }

    const refresh = () => {
      const vpId = viewportGridService?.getActiveViewportId?.() ?? null;
      setActiveViewportId(vpId);

      const toolGroup = getToolGroup(vpId);
      const toolGroupId = toolGroup?.id ?? toolGroup; // handle object or string

      if (vpId && toolGroup && typeof toolGroup.addViewport === 'function') {
        try {
          const renderingEngineId =
            servicesManager.services.cornerstoneViewportService?.getRenderingEngineId?.(vpId);
          if (renderingEngineId) {
            toolGroup.addViewport(vpId, renderingEngineId);
          }
        } catch (err) {
          console.warn('Failed to bind viewport to toolGroup', err);
        }
      }

      try {
        toolbarService.refreshToolbarState({ viewportId: vpId, toolGroupId });
      } catch (error) {
        console.warn('toolbarService.refreshToolbarState failed', error);
      }

      console.log('Active VP:', vpId);
      console.log('ToolGroup (obj):', toolGroup);
      console.log('ToolGroup id:', toolGroupId);

      // dump registered tools
      if (toolGroup?._toolInstances) {
        if (toolGroup._toolInstances instanceof Map) {
          console.log('Registered tools:', Array.from(toolGroup._toolInstances.keys()));
        } else {
          console.log('Registered tools:', Object.keys(toolGroup._toolInstances));
        }
      }

      /*
      console.log('Active VP:', vpId, 'ToolGroup:', toolGroup?.id, 'Tools:', [
        ...(toolGroup?._toolInstances?.keys?.() ?? []),
      ]); */
    };

    // Try subscribing to viewportGridService event(s)
    let unsubscribeFromViewport: any = null;
    const EVENTS = viewportGridService?.EVENTS ?? viewportGridService?.events ?? null;

    // Common event name in OHIF is ACTIVE_VIEWPORT_SET / ACTIVE_VIEWPORT_CHANGED — try both
    const candidateEvents = [
      EVENTS?.ACTIVE_VIEWPORT_CHANGED,
      EVENTS?.ACTIVE_VIEWPORT_SET,
      'ACTIVE_VIEWPORT_CHANGED',
      'ACTIVE_VIEWPORT_SET',
    ].filter(Boolean);

    try {
      for (const ev of candidateEvents) {
        if (viewportGridService?.subscribe && typeof viewportGridService.subscribe === 'function') {
          // some subscribe returns { unsubscribe }, others return function, be defensive
          const sub = viewportGridService.subscribe(ev, refresh);
          unsubscribeFromViewport = sub;
          break;
        }
      }
    } catch (err) {
      // ignore subscribe failure
    }

    // fallback: try generic subscribe (if service exposes a subscribe without event names)
    if (!unsubscribeFromViewport && viewportGridService?.subscribe) {
      try {
        unsubscribeFromViewport = viewportGridService.subscribe(refresh);
      } catch (err) {
        // ignore
      }
    }

    // Last-resort: poll active viewport every 250ms for changes
    refresh();
    const poll = setInterval(refresh, 250);

    return () => {
      clearInterval(poll);
      try {
        if (unsubscribeFromViewport) {
          if (typeof unsubscribeFromViewport.unsubscribe === 'function') {
            unsubscribeFromViewport.unsubscribe();
          } else if (typeof unsubscribeFromViewport === 'function') {
            unsubscribeFromViewport();
          }
        }
      } catch (e) {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolbarService, viewportGridService, toolGroupService]);

  // Also pass the refreshProps into the Toolbar component if your copied Toolbar
  // uses getButtonSection(section, props) to apply contextual props
  const refreshProps = { viewportId: activeViewportId, toolGroup: getToolGroup(activeViewportId) };

  return (
    <div
      style={{
        minWidth: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        overflow: 'auto',
        borderRight: '1px solid rgba(0,0,0,0.12)',
        padding: 8,
      }}
    >
      {/* many Toolbar implementations support receiving props that get forwarded to toolbarService.getButtonSection */}
      <Toolbar
        buttonSection="primary"
        orientation="vertical"
        servicesManager={servicesManager}
        refreshProps={{
          viewportId: activeViewportId,
          toolGroupId: getToolGroup(activeViewportId)?.id,
        }}
      />
    </div>
  );
}
