import React from 'react';
import { useToolbar } from '@ohif/core';

interface ToolbarProps {
  buttonSection?: string;
  viewportId?: string | null;
  location?: number;
  refreshProps?: Record<string, any>; // 👈 add this
}

export function Toolbar({
  buttonSection = 'primary',
  viewportId,
  location,
  refreshProps = {},
}: ToolbarProps) {
  const {
    toolbarButtons,
    onInteraction,
    isItemOpen,
    isItemLocked,
    openItem,
    closeItem,
    toggleLock,
  } = useToolbar({
    buttonSection,
    ...refreshProps, // 👈 forward viewportId/toolGroup/etc
  });

  if (!toolbarButtons.length) {
    return null;
  }

  return (
    <>
      {toolbarButtons.map(toolDef => {
        if (!toolDef) {
          return null;
        }

        const { id, Component, componentProps } = toolDef;

        const enhancedProps = {
          ...componentProps,
          isOpen: isItemOpen(id, viewportId),
          isLocked: isItemLocked(id, viewportId),
          onOpen: () => openItem(id, viewportId),
          onClose: () => closeItem(id, viewportId),
          onToggleLock: () => toggleLock(id, viewportId),
          viewportId,
        };

        return (
          <div key={id}>
            <Component
              id={id}
              location={location}
              onInteraction={args =>
                onInteraction({
                  ...args,
                  itemId: id,
                  viewportId,
                })
              }
              {...enhancedProps}
            />
          </div>
        );
      })}
    </>
  );
}
export default Toolbar;
