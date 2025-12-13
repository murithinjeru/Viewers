/** @type {AppTypes.Config} */
window.config = {
  routerBasename: '/ohif',
  extensions: [],
  modes: ['@ohif/mode-longitudinal'],
  showStudyList: false,
  // below flag is for performance reasons, but it might not work for all servers
  investigationalUseDialog: { option: 'never' },
  maxNumberOfWebWorkers: 3,
  showWarningMessageForCrossOrigin: false,
  showCPUFallbackMessage: false,
  strictZSpacingForVolumeViewport: true,
  // filterQueryParam: false,
  studyPrefetcher: {
    enabled: true,
    displaySetsCount: 15, // how many neighbor displaySets to fetch
    maxNumPrefetchRequests: 15, // concurrency; keep moderate
    order: 'closest', // 'closest' | 'downward' | 'upward'
  },
  cornerstone: {
    useSharedArrayBuffer: 'FALSE', // run on main thread unless you’ve set COOP/COEP
    rendering: {
      useNorm16Texture: true, // preferred (2× less GPU memory than float32)
      preferSizeOverAccuracy: true, // fallback if norm16 extension isn’t available
    },
  },
  // Add some customizations to the default e2e datasource
  customizationService: [
    //'@ohif/extension-default.customizationModule.datasources',
    '@ohif/extension-default.customizationModule.helloPage',
  ],

  defaultDataSourceName: 'orthanc-local',
  investigationalUseDialog: {
    option: 'never',
  },
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'orthanc-local',
      configuration: {
        friendlyName: 'Local Orthanc (DICOMweb)',
        name: 'orthanc',
        // DO NOT use staticWado for a live DICOMweb server
        staticWado: false,
        // Point to Orthanc dicom-web plugin endpoint (default Orthanc HTTP port = 8042)
        qidoRoot: 'http://localhost:8043/dicom-web',
        wadoUriRoot: 'http://localhost:8043/wado',
        wadoRoot: 'http://localhost:8043/dicom-web',
        qidoSupportsIncludeField: true,
        supportsReject: true,
        supportsStow: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        singlepart: 'bulkdata,video,pdf',
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'local5000',
      configuration: {
        friendlyName: 'Static WADO Local Data',
        name: 'DCM4CHEE',
        qidoRoot: 'http://localhost:8043/dicom-web',
        wadoUriRoot: 'http://localhost:8043/wado',
        wadoRoot: 'http://localhost:8043/dicom-web',
        qidoSupportsIncludeField: false,
        supportsReject: true,
        supportsStow: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'video',
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'docker',
      configuration: {
        friendlyName: 'Static WADO Docker Data',
        name: 'DCM4CHEE',
        qidoRoot: 'http://localhost:8043/dicom-web',
        wadoUriRoot: 'http://localhost:8043/wado',
        wadoRoot: 'http://localhost:8043/dicom-web',
        qidoSupportsIncludeField: false,
        supportsReject: true,
        supportsStow: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'bulkdata,video,pdf',
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'ohif',
      configuration: {
        friendlyName: 'AWS S3 Static wado server',
        name: 'aws',
        qidoRoot: 'http://localhost:8043/dicom-web',
        wadoUriRoot: 'http://localhost:8043/wado',
        wadoRoot: 'http://localhost:8043/dicom-web',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'video,pdf',
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
      },
    },

    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'ohif2',
      configuration: {
        friendlyName: 'AWS S3 Static wado secondary server',
        name: 'aws',
        qidoRoot: 'http://localhost:8043/dicom-web',
        wadoUriRoot: 'http://localhost:8043/wado',
        wadoRoot: 'http://localhost:8043/dicom-web',
        qidoSupportsIncludeField: false,
        supportsReject: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'bulkdata,video',
        // whether the data source should use retrieveBulkData to grab metadata,
        // and in case of relative path, what would it be relative to, options
        // are in the series level or study level (some servers like series some study)
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
        omitQuotationForMultipartRequest: true,
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'ohif3',
      configuration: {
        friendlyName: 'AWS S3 Static wado secondary server',
        name: 'aws',
        qidoRoot: 'http://localhost:8043/dicom-web',
        wadoUriRoot: 'http://localhost:8043/wado',
        wadoRoot: 'http://localhost:8043/dicom-web',
        qidoSupportsIncludeField: false,
        supportsReject: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        singlepart: 'bulkdata,video',
        // whether the data source should use retrieveBulkData to grab metadata,
        // and in case of relative path, what would it be relative to, options
        // are in the series level or study level (some servers like series some study)
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
        omitQuotationForMultipartRequest: true,
      },
    },

    {
      friendlyName: 'StaticWado default data',
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        name: 'DCM4CHEE',
        qidoRoot: 'http://localhost:8043/dicom-web',
        wadoUriRoot: 'http://localhost:8043/wado',
        wadoRoot: 'http://localhost:8043/dicom-web',
        qidoSupportsIncludeField: false,
        supportsReject: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: true,
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'studies',
        },
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
    // This is 429 when rejected from the public idc sandbox too often.
    console.warn(error.status);

    // Could use services manager here to bring up a dialog/modal if needed.
    console.warn('test, navigate to https://ohif.org/');
  },
  hotkeys: [],

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
