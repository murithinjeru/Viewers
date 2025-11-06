/** @type {AppTypes.Config} */
window.config = {
  routerBasename: '/ohif',
  showStudyList: false,
  extensions: [],
  modes: ['@ohif/mode-longitudinal'],
  // below flag is for performance reasons, but it might not work for all servers
  investigationalUseDialog: { option: 'never' },
  showWarningMessageForCrossOrigin: false,
  showCPUFallbackMessage: true,
  showLoadingIndicator: true,
  experimentalStudyBrowserSort: false,
  strictZSpacingForVolumeViewport: true,
  cornerstone3D: {
    useNorm16Texture: true, // if the browser exposes EXT_texture_norm16
    useCPURendering: true, // default; can be toggled as a fallback test
    preferSizeOverAccuracy: true,
  },
  studyPrefetcher: {
    enabled: true,
    displaySetsCount: 15, // how many neighbor displaySets to fetch
    maxNumPrefetchRequests: 15, // concurrency; keep moderate
    order: 'closest', // 'closest' | 'downward' | 'upward'
  },
  defaultDataSourceName: 'dicomweb',
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        friendlyName: 'Orthanc Server',
        name: 'Orthanc',
        wadoUriRoot: '/wado',
        qidoRoot: '/pacs/dicom-web',
        wadoRoot: '/pacs/dicom-web',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        dicomUploadEnabled: true,
        omitQuotationForMultipartRequest: true,
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomjson',
      sourceName: 'dicomjson',
      configuration: {
        friendlyName: 'dicom json',
        name: 'json',
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomlocal',
      sourceName: 'dicomlocal',
      configuration: {
        friendlyName: 'dicom local',
      },
    },
  ],
  httpErrorHandler: error => {
    console.warn(`HTTP Error Handler (status: ${error.status})`, error);
  },
  whiteLabeling: {
    createLogoComponentFn: function (React) {
      return React.createElement(
        'div', // changed from 'a' to 'div'
        {
          className: 'text-purple-600 line-through cursor-default select-none',
        },
        React.createElement('img', {
          src: './Radsys.png',
          className: 'w-8 h-8 object-contain',
        })
      );
    },
  },
};
