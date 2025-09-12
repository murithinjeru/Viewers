import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button, Header, Icons, useModal } from '@ohif/ui-next';
import { useSystem } from '@ohif/core';
import { Toolbar } from '../Toolbar/Toolbar';
import HeaderPatientInfo from './HeaderPatientInfo';
import { PatientInfoVisibility } from './HeaderPatientInfo/HeaderPatientInfo';
import { preserveQueryParameters } from '@ohif/app';
import { Types } from '@ohif/core';

function ViewerHeader({ appConfig }: withAppTypes<{ appConfig: AppTypes.Config }>) {
  const { servicesManager, extensionManager, commandsManager } = useSystem();
  const { customizationService } = servicesManager.services;

  const navigate = useNavigate();
  const location = useLocation();

  const onClickReturnButton = () => {
    const { pathname } = location;
    const dataSourceIdx = pathname.indexOf('/', 1);

    const dataSourceName = pathname.substring(dataSourceIdx + 1);
    const existingDataSource = extensionManager.getDataSources(dataSourceName);

    const searchQuery = new URLSearchParams();
    if (dataSourceIdx !== -1 && existingDataSource) {
      searchQuery.append('datasources', pathname.substring(dataSourceIdx + 1));
    }
    preserveQueryParameters(searchQuery);

    navigate({
      pathname: '/',
      search: decodeURIComponent(searchQuery.toString()),
    });
  };

  const { t } = useTranslation();
  const { show } = useModal();

  const AboutModal = customizationService.getCustomization(
    'ohif.aboutModal'
  ) as Types.MenuComponentCustomization;

  const UserPreferencesModal = customizationService.getCustomization(
    'ohif.userPreferencesModal'
  ) as Types.MenuComponentCustomization;

  const menuOptions = [
    {
      title: AboutModal?.menuTitle ?? t('Header:About'),
      icon: 'info',
      onClick: () =>
        show({
          content: AboutModal,
          title: AboutModal?.title ?? t('AboutModal:About OHIF Viewer'),
          containerClassName: AboutModal?.containerClassName ?? 'max-w-md',
        }),
    },
    {
      title: UserPreferencesModal.menuTitle ?? t('Header:Preferences'),
      icon: 'settings',
      onClick: () =>
        show({
          content: UserPreferencesModal,
          title: UserPreferencesModal.title ?? t('UserPreferencesModal:User preferences'),
          containerClassName:
            UserPreferencesModal?.containerClassName ?? 'flex max-w-4xl p-6 flex-col',
        }),
    },
  ];

  if (appConfig.oidc) {
    menuOptions.push({
      title: t('Header:Logout'),
      icon: 'power-off',
      onClick: async () => {
        navigate(`/logout?redirect_uri=${encodeURIComponent(window.location.href)}`);
      },
    });
  }

  return (
    <div className="flex h-screen w-16 flex-col bg-black">
      <Header
        className="flex min-h-0 flex-1 flex-col items-center justify-between pt-0"
        style={{ height: '100%' }} // force 100%
        menuOptions={menuOptions}
        //isReturnEnabled={!!appConfig.showStudyList}
        //onClickReturnButton={onClickReturnButton}
        WhiteLabeling={appConfig.whiteLabeling}
      >
        {/* Full height flex container INSIDE header */}
        <div
          className="flex min-h-0 flex-1 flex-col justify-between"
          style={{ paddingTop: '800px' }}
        >
          {/* 🔹 Top */}
          <div className="flex min-h-0 flex-1 flex-col items-end gap-2">
            {appConfig.showPatientInfo !== PatientInfoVisibility.VISIBLE && (
              <div className="w-full max-w-[500px] overflow-visible sm:max-w-[500px]">
                <HeaderPatientInfo
                  servicesManager={servicesManager}
                  appConfig={appConfig}
                />
              </div>
            )}
          </div>

          {/* 🔹 Middle */}
          <div
            className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto"
            style={{ paddingTop: '0px' }}
          >
            <Toolbar
              buttonSection="primary"
              orientation="vertical"
            />
            <Toolbar
              buttonSection="secondary"
              orientation="vertical"
            />
          </div>

          {/* 🔹 Bottom */}
          <div
            className="flex flex-col items-center gap-2"
            style={{ paddingTop: '30px' }}
          >
            <Button
              variant="ghost"
              className="hover:bg-primary-dark"
              onClick={() => commandsManager.run('undo')}
            >
              <Icons.Undo />
            </Button>
            <Button
              variant="ghost"
              className="hover:bg-primary-dark"
              onClick={() => commandsManager.run('redo')}
            >
              <Icons.Redo />
            </Button>
          </div>
        </div>
      </Header>
    </div>
  );
}

export default ViewerHeader;
