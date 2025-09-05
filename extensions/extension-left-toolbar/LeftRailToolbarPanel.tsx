import React, { useEffect, useState, useRef } from 'react';

type Sub = { unsubscribe?: () => void } | void;

export default function LeftRailToolbarPanel({ servicesManager }: { servicesManager?: any }) {
  if (!servicesManager || !servicesManager.services) {
    return <div style={{ padding: 8 }}>Toolbar not ready</div>;
  }

  // service may be under different names in different builds (defensive)
  const toolbarService =
    servicesManager.services.toolbarService ??
    servicesManager.services.ToolBarService ??
    servicesManager.services.toolbar;

  const pubSubService = servicesManager.services.pubSubService;

  const [buttons, setButtons] = useState<any[]>([]);
  const subRef = useRef<Sub | null>(null);

  // normalize helper
  const loadButtons = () => {
    let btns = toolbarService?.getButtons
      ? toolbarService.getButtons(toolbarService.sections?.primary)
      : toolbarService?.getButtonSection
        ? toolbarService.getButtonSection(toolbarService.sections?.primary)
        : null;

    if (!btns) {
      btns = [];
    } else if (!Array.isArray(btns)) {
      btns = Object.values(btns);
    }

    setButtons(btns);
  };

  useEffect(() => {
    if (!toolbarService) {
      console.warn('LeftRailToolbarPanel: toolbarService not found on servicesManager.services', {
        services: Object.keys(servicesManager.services),
      });
      return;
    }

    loadButtons(); // initial load

    // subscribe helper tries several sensible patterns
    const trySubscribe = () => {
      // 1) preferred: subscribe(eventName, callback) — typical in v3 (TOOL_BAR_MODIFIED)
      const EVENTS = toolbarService.EVENTS ?? toolbarService.events ?? null;

      if (EVENTS && (EVENTS.TOOL_BAR_MODIFIED || EVENTS.TOOL_BAR_STATE_MODIFIED)) {
        const eventName = EVENTS.TOOL_BAR_MODIFIED ?? EVENTS.TOOL_BAR_STATE_MODIFIED;
        try {
          const sub = toolbarService.subscribe(eventName, () => {
            loadButtons();
          });
          return sub;
        } catch (err) {
          console.debug('subscribe(event, cb) failed', err);
          // fallthrough
        }
      }

      // 2) some versions support subscribe(callback) only
      try {
        const sub = toolbarService.subscribe((/* maybe state */) => {
          loadButtons();
        });
        return sub;
      } catch (err) {
        console.debug('subscribe(cb) failed', err);
        // fallthrough
      }

      // 3) try pubSubService fallback (service publishes toolbar events there)
      if (pubSubService && typeof pubSubService.subscribe === 'function') {
        try {
          // common pubsub event used by services is 'TOOL_BAR_MODIFIED' (doc)
          const pubSubSub = pubSubService.subscribe('TOOL_BAR_MODIFIED', () => {
            loadButtons();
          });
          return pubSubSub;
        } catch (err) {
          console.debug('pubSubService.subscribe failed', err);
        }
      }

      // 4) last-resort fallback: poll every 500ms
      const timer = setInterval(loadButtons, 500);
      return { unsubscribe: () => clearInterval(timer) };
    };

    const subscription = trySubscribe();
    subRef.current = subscription ?? null;

    return () => {
      // cleanup
      if (subRef.current && typeof (subRef.current as any).unsubscribe === 'function') {
        (subRef.current as any).unsubscribe();
      }
      subRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolbarService, pubSubService]);

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
      {buttons.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.6 }}>No tools</div>
      ) : (
        buttons.map((btn: any) => {
          const ButtonComp = btn.component ?? btn.Component ?? btn.defaultComponent;
          if (!ButtonComp) {
            return null;
          }
          return (
            <ButtonComp
              key={btn.id ?? btn.name}
              {...(btn.props || {})}
            />
          );
        })
      )}
    </div>
  );
}
