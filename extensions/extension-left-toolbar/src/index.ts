import LeftRailToolbarPanel from './LeftRailToolbarPanel';

export default function getPanelModule() {
  return [
    {
      name: 'leftRailToolbarPanel',
      iconName: 'tool',
      label: 'Tools',
      component: LeftRailToolbarPanel, // 👈 pass the function itself
    },
  ];
}
