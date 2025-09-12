import React from 'react';
import { useToolbar } from '@ohif/core';

interface ToolbarProps {
  buttonSection?: string;
  viewportId?: string;
  location?: number;
  orientation?: 'horizontal' | 'vertical';
}

export function Toolbar({
  buttonSection = 'primary',
  viewportId,
  location,
  orientation = 'horizontal',
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
  });

  if (!toolbarButtons.length) {
    return null;
  }

  return (
    <div
      className={`flex ${
        orientation === 'vertical'
          ? 'flex-col items-center gap-2'
          : 'flex-row flex-wrap items-center gap-1'
      }`}
    >
      {toolbarButtons.map(toolDef => {
        if (!toolDef) return null;
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
          <Component
            key={id}
            id={id}
            location={location}
            onInteraction={args => onInteraction({ ...args, itemId: id, viewportId })}
            {...enhancedProps}
          />
        );
      })}
    </div>
  );
}
