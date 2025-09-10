// ToolButtonWrapper.tsx
import React from 'react';
import { useIconPresentation, Icons, Button } from '@ohif/ui-next';

export default function ToolButtonWrapper(props: any) {
  const {
    id,
    icon,
    disabled,
    tooltip,
    disabledText,
    isOpen,
    isLocked,
    onInteraction,
    onOpen,
    onClose,
    onToggleLock,
    children,
    ...rest
  } = props;

  const { IconContainer, containerProps } = useIconPresentation();

  // Icon can be string or React node
  const Icon = typeof icon === 'string' ? <Icons.ByName name={icon} /> : icon || null;

  // Handle clicks → forward into OHIF toolbar logic
  const handleClick = (evt: React.MouseEvent) => {
    if (typeof onInteraction === 'function') {
      onInteraction({ itemId: id, originalEvent: evt });
    }
  };

  const commonProps = {
    title: tooltip || disabledText || id,
    disabled,
    'aria-pressed': isOpen ?? false,
    'aria-locked': isLocked ?? false,
    onClick: handleClick,
  };

  return (
    <div>
      {IconContainer ? (
        <IconContainer
          {...containerProps}
          {...commonProps}
        >
          {Icon}
        </IconContainer>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          {...commonProps}
        >
          {Icon}
        </Button>
      )}
    </div>
  );
}

export { ToolButtonWrapper };
