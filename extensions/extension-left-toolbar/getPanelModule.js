import React from 'react';
import LeftRailToolbarPanel from './LeftRailToolbarPanel';

export default function getPanelModule({ servicesManager, commandsManager, extensionManager }) {
  const WrappedLeftRailToolbarPanel = () =>
    React.createElement(LeftRailToolbarPanel, {
      servicesManager,
      commandsManager,
    });

  return [
    {
      name: 'leftRailToolbarPanel',
      iconName: 'tool',
      label: 'Tools',
      component: WrappedLeftRailToolbarPanel,
    },
  ];
}
