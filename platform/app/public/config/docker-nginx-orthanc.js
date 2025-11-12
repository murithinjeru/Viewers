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
  cornerstone: {
    useSharedArrayBuffer: 'FALSE', // run on main thread unless you’ve set COOP/COEP
    rendering: {
      useNorm16Texture: true, // preferred (2× less GPU memory than float32)
      preferSizeOverAccuracy: true, // fallback if norm16 extension isn’t available
    },
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
        qidoSupportsIncludeField: true,
        supportsReject: true,
        supportsStow: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        dicomUploadEnabled: false,
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
