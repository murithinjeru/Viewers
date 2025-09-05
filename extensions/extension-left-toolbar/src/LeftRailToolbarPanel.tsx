import React, { useEffect, useState } from 'react';

export default function LeftRailToolbarPanel({ servicesManager }) {
  const { toolbarService } = servicesManager.services;
  const [buttons, setButtons] = useState([]);

  useEffect(() => {
    // Initial fetch of buttons from the "primary" toolbar section
    setButtons(toolbarService.getButtons(toolbarService.sections.primary) || []);

    // Subscribe to updates
    const sub = toolbarService.subscribe(toolbarService.EVENTS.SECTION_UPDATED, evt => {
      if (evt.sectionId === toolbarService.sections.primary) {
        setButtons(toolbarService.getButtons(toolbarService.sections.primary));
      }
    });

    return () => sub.unsubscribe();
  }, [toolbarService]);

  return (
    <div className="min-w-16 flex h-full w-16 flex-col items-center gap-2 overflow-auto border-r border-black/20 bg-black/10 p-2">
      {buttons.map(btn => {
        const ButtonComp = btn.component;
        return (
          <ButtonComp
            key={btn.id}
            {...btn.props}
          />
        );
      })}
    </div>
  );
}
