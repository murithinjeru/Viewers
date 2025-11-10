import React, { useState, useLayoutEffect, useEffect, useCallback, useRef } from 'react';
import { useImageViewer } from '@ohif/ui-next';
import { useSystem, utils } from '@ohif/core';
import { useNavigate } from 'react-router-dom';
import { useViewportGrid, StudyBrowser, Separator } from '@ohif/ui-next';
import { PanelStudyBrowserHeader } from './PanelStudyBrowserHeader';
import { defaultActionIcons } from './constants';
import MoreDropdownMenu from '../../Components/MoreDropdownMenu';
import { CallbackCustomization } from 'platform/core/src/types';
import { eventTarget, Enums, cache, metaData } from '@cornerstonejs/core';

const { sortStudyInstances, formatDate, createStudyBrowserTabs } = utils;

const thumbnailNoImageModalities = ['SR', 'SEG', 'RTSTRUCT', 'RTPLAN', 'RTDOSE', 'DOC', 'PMAP'];

/**
 * Study Browser component that displays and manages studies and their display sets
 */
function PanelStudyBrowser({
  getImageSrc,
  getStudiesForPatientByMRN,
  requestDisplaySetCreationForStudy,
  dataSource,
  customMapDisplaySets,
  onClickUntrack,
  onDoubleClickThumbnailHandlerCallBack,
}) {
  const { servicesManager, commandsManager, extensionManager } = useSystem();
  const { displaySetService, customizationService } = servicesManager.services;
  const navigate = useNavigate();
  const studyMode = customizationService.getCustomization('studyBrowser.studyMode') || 'all';

  const internalImageViewer = useImageViewer();
  const StudyInstanceUIDs = internalImageViewer.StudyInstanceUIDs;
  const fetchedStudiesRef = useRef(new Set());

  const [{ activeViewportId, viewports, isHangingProtocolLayout }] = useViewportGrid();
  const [activeTabName, setActiveTabName] = useState(studyMode);
  const [expandedStudyInstanceUIDs, setExpandedStudyInstanceUIDs] = useState([
    ...StudyInstanceUIDs,
  ]);
  const [hasLoadedViewports, setHasLoadedViewports] = useState(false);
  const [studyDisplayList, setStudyDisplayList] = useState([]);
  const [displaySets, setDisplaySets] = useState([]);

  // { [displaySetInstanceUID]: { total: number; loaded: number; done?: boolean } }
  const [displaySetsLoadingState, setDisplaySetsLoadingState] = useState<
    Record<string, { total: number; loaded: number; done?: boolean }>
  >({});
  const [thumbnailImageSrcMap, setThumbnailImageSrcMap] = useState<Record<string, string>>({});
  const [jumpToDisplaySet, setJumpToDisplaySet] = useState<string | null>(null);

  const [viewPresets, setViewPresets] = useState(
    customizationService.getCustomization('studyBrowser.viewPresets')
  );

  const [actionIcons, setActionIcons] = useState(defaultActionIcons);

  // OPTIONAL: expose progress to DevTools as __ohifProgress
  useEffect(() => {
    (window as any).__ohifProgress = displaySetsLoadingState;
  }, [displaySetsLoadingState]);

  // multiple can be true or false
  const updateActionIconValue = actionIcon => {
    actionIcon.value = !actionIcon.value;
    const newActionIcons = [...actionIcons];
    setActionIcons(newActionIcons);
  };

  // only one is true at a time
  const updateViewPresetValue = viewPreset => {
    if (!viewPreset) {
      return;
    }
    const newViewPresets = viewPresets.map(preset => {
      preset.selected = preset.id === viewPreset.id;
      return preset;
    });
    setViewPresets(newViewPresets);
  };

  const mapDisplaySetsWithState = customMapDisplaySets || _mapDisplaySets;

  const onDoubleClickThumbnailHandler = useCallback(
    async displaySetInstanceUID => {
      const customHandler = customizationService.getCustomization(
        'studyBrowser.thumbnailDoubleClickCallback'
      ) as CallbackCustomization;

      const setupArgs = {
        activeViewportId,
        commandsManager,
        servicesManager,
        isHangingProtocolLayout,
        appConfig: extensionManager._appConfig,
      };

      const handlers = customHandler?.callbacks.map(callback => callback(setupArgs));

      for (const handler of handlers) {
        await handler(displaySetInstanceUID);
      }
      onDoubleClickThumbnailHandlerCallBack?.(displaySetInstanceUID);
    },
    [
      activeViewportId,
      commandsManager,
      servicesManager,
      isHangingProtocolLayout,
      customizationService,
      extensionManager,
      onDoubleClickThumbnailHandlerCallBack,
    ]
  );

  // ~~ studyDisplayList
  useEffect(() => {
    // Fetch all studies for the patient in each primary study
    async function fetchStudiesForPatient(StudyInstanceUID) {
      // Skip fetching if we've already fetched this study
      if (fetchedStudiesRef.current.has(StudyInstanceUID)) {
        return;
      }

      fetchedStudiesRef.current.add(StudyInstanceUID);

      // current study qido
      const qidoForStudyUID = await dataSource.query.studies.search({
        studyInstanceUid: StudyInstanceUID,
      });

      if (!qidoForStudyUID?.length) {
        navigate('/notfoundstudy', '_self');
        throw new Error('Invalid study URL');
      }

      const qidoStudiesForPatient = qidoForStudyUID;

      // try to fetch the prior studies based on the patientID if the
      // server can respond.
      /**
      try {
        qidoStudiesForPatient = await getStudiesForPatientByMRN(qidoForStudyUID);
      } catch (error) {
        console.warn(error);
      }
      */
      const mappedStudies = _mapDataSourceStudies(qidoStudiesForPatient);
      const actuallyMappedStudies = mappedStudies.map(qidoStudy => {
        return {
          studyInstanceUid: qidoStudy.StudyInstanceUID,
          date: formatDate(qidoStudy.StudyDate) || '',
          description: qidoStudy.StudyDescription,
          modalities: qidoStudy.ModalitiesInStudy,
          numInstances: Number(qidoStudy.NumInstances),
        };
      });

      setStudyDisplayList(prevArray => {
        const ret = [...prevArray];
        for (const study of actuallyMappedStudies) {
          if (!prevArray.find(it => it.studyInstanceUid === study.studyInstanceUid)) {
            ret.push(study);
          }
        }
        return ret;
      });
    }

    StudyInstanceUIDs.forEach(sid => fetchStudiesForPatient(sid));
  }, [StudyInstanceUIDs, dataSource, getStudiesForPatientByMRN, navigate]);

  // ~~ Initial Thumbnails
  useEffect(() => {
    if (!hasLoadedViewports) {
      if (activeViewportId) {
        // Once there is an active viewport id, it means the layout is ready
        // so wait a bit of time to allow the viewports preferential loading
        // which improves user experience of responsiveness significantly on slower
        // systems.
        const delayMs = 250 + displaySetService.getActiveDisplaySets().length * 10;
        window.setTimeout(() => setHasLoadedViewports(true), delayMs);
      }

      return;
    }

    let currentDisplaySets = displaySetService.activeDisplaySets;
    // filter non based on the list of modalities that are supported by cornerstone
    currentDisplaySets = currentDisplaySets.filter(
      ds => !thumbnailNoImageModalities.includes(ds.Modality) || ds.thumbnailSrc === null
    );

    if (!currentDisplaySets.length) {
      return;
    }

    currentDisplaySets.forEach(async dSet => {
      const newImageSrcEntry: Record<string, string> = {};
      const displaySet = displaySetService.getDisplaySetByUID(dSet.displaySetInstanceUID);
      const imageIds = dataSource.getImageIdsForDisplaySet(dSet);

      const imageId = getImageIdForThumbnail(displaySet, imageIds);

      // TODO: Is it okay that imageIds are not returned here for SR displaySets?
      if (displaySet?.unsupported) {
        return;
      }
      // When the image arrives, render it and store the result in the thumbnailImgSrcMap
      let { thumbnailSrc } = displaySet as any;
      if (!thumbnailSrc && (displaySet as any).getThumbnailSrc) {
        thumbnailSrc = await (displaySet as any).getThumbnailSrc({ getImageSrc });
      }
      if (!thumbnailSrc && imageId) {
        const tSrc = await getImageSrc(imageId);
        (displaySet as any).thumbnailSrc = tSrc;
        thumbnailSrc = tSrc;
      }
      newImageSrcEntry[dSet.displaySetInstanceUID] = thumbnailSrc;

      setThumbnailImageSrcMap(prevState => {
        return { ...prevState, ...newImageSrcEntry };
      });
    });
  }, [displaySetService, dataSource, getImageSrc, activeViewportId, hasLoadedViewports]);

  // ~~ displaySets (map + render data)
  useEffect(() => {
    const currentDisplaySets = displaySetService.activeDisplaySets;

    if (!currentDisplaySets.length) {
      return;
    }

    const mappedDisplaySets = mapDisplaySetsWithState(
      currentDisplaySets,
      displaySetsLoadingState,
      thumbnailImageSrcMap,
      viewports
    );

    if (!customMapDisplaySets) {
      sortStudyInstances(mappedDisplaySets);
    }

    setDisplaySets(mappedDisplaySets);
  }, [
    displaySetService.activeDisplaySets,
    displaySetsLoadingState,
    viewports,
    thumbnailImageSrcMap,
    customMapDisplaySets,
  ]);

  // ~~ subscriptions --> displaySets (thumbnails for newly added sets)
  useEffect(() => {
    // DISPLAY_SETS_ADDED returns an array of DisplaySets that were added
    const SubscriptionDisplaySetsAdded = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_ADDED,
      data => {
        if (!hasLoadedViewports) {
          return;
        }
        const { displaySetsAdded, options } = data;
        displaySetsAdded.forEach(async dSet => {
          const displaySetInstanceUID = dSet.displaySetInstanceUID;
          const newImageSrcEntry: Record<string, string> = {};
          const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);
          if (displaySet?.unsupported) {
            return;
          }
          if (options?.madeInClient) {
            setJumpToDisplaySet(displaySetInstanceUID);
          }

          const imageIds = dataSource.getImageIdsForDisplaySet(displaySet);
          const imageId = getImageIdForThumbnail(displaySet, imageIds);

          // TODO: Is it okay that imageIds are not returned here for SR displaysets?
          if (!imageId) {
            return;
          }

          // When the image arrives, render it and store the result in the thumbnailImgSrcMap
          let { thumbnailSrc } = displaySet as any;
          if (!thumbnailSrc && (displaySet as any).getThumbnailSrc) {
            thumbnailSrc = await (displaySet as any).getThumbnailSrc({ getImageSrc });
          }
          if (!thumbnailSrc) {
            thumbnailSrc = await getImageSrc(imageId);
            (displaySet as any).thumbnailSrc = thumbnailSrc;
          }
          newImageSrcEntry[displaySetInstanceUID] = thumbnailSrc;

          setThumbnailImageSrcMap(prevState => {
            return { ...prevState, ...newImageSrcEntry };
          });
        });
      }
    );

    return () => {
      SubscriptionDisplaySetsAdded.unsubscribe();
    };
  }, [displaySetService, dataSource, getImageSrc, hasLoadedViewports]);

  // ~~ other displaySetService subscriptions (remap on change/metadata invalidation)
  useEffect(() => {
    const SubscriptionDisplaySetsChanged = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_CHANGED,
      changedDisplaySets => {
        const mappedDisplaySets = mapDisplaySetsWithState(
          changedDisplaySets,
          displaySetsLoadingState,
          thumbnailImageSrcMap,
          viewports
        );

        if (!customMapDisplaySets) {
          sortStudyInstances(mappedDisplaySets);
        }

        setDisplaySets(mappedDisplaySets);
      }
    );

    const SubscriptionDisplaySetMetaDataInvalidated = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SET_SERIES_METADATA_INVALIDATED,
      () => {
        const mappedDisplaySets = mapDisplaySetsWithState(
          displaySetService.getActiveDisplaySets(),
          displaySetsLoadingState,
          thumbnailImageSrcMap,
          viewports
        );

        if (!customMapDisplaySets) {
          sortStudyInstances(mappedDisplaySets);
        }

        setDisplaySets(mappedDisplaySets);
      }
    );

    return () => {
      SubscriptionDisplaySetsChanged.unsubscribe();
      SubscriptionDisplaySetMetaDataInvalidated.unsubscribe();
    };
  }, [
    displaySetsLoadingState,
    thumbnailImageSrcMap,
    viewports,
    displaySetService,
    customMapDisplaySets,
  ]);

  //const tabs = createStudyBrowserTabs(StudyInstanceUIDs, studyDisplayList, displaySets);

  const tabs = createTabsWithProgress(StudyInstanceUIDs, studyDisplayList, displaySets);
  //const tabsRaw = createTabsWithProgress(StudyInstanceUIDs, studyDisplayList, displaySets);
  //const tabs = sanitizeTabsForThumbnails(tabsRaw);
  // ~~ expand / collapse study (and request display set creation)
  function _handleStudyClick(StudyInstanceUID) {
    const shouldCollapseStudy = expandedStudyInstanceUIDs.includes(StudyInstanceUID);
    const updatedExpandedStudyInstanceUIDs = shouldCollapseStudy
      ? [...expandedStudyInstanceUIDs.filter(stdyUid => stdyUid !== StudyInstanceUID)]
      : [...expandedStudyInstanceUIDs, StudyInstanceUID];

    setExpandedStudyInstanceUIDs(updatedExpandedStudyInstanceUIDs);

    if (!shouldCollapseStudy) {
      const madeInClient = true;
      requestDisplaySetCreationForStudy(displaySetService, StudyInstanceUID, madeInClient);
    }
  }

  // ~~ ensure we scroll the newly created displaySet into view
  useEffect(() => {
    if (jumpToDisplaySet) {
      const displaySetInstanceUID = jumpToDisplaySet;
      const element = document.getElementById(`thumbnail-${displaySetInstanceUID}`);

      if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'smooth' });
        setJumpToDisplaySet(null);
      }
    }
  }, [jumpToDisplaySet, expandedStudyInstanceUIDs, activeTabName]);

  // ~~ ensure the correct tab is active for the displaySet we jump to
  useEffect(() => {
    if (!jumpToDisplaySet) {
      return;
    }

    const displaySetInstanceUID = jumpToDisplaySet;
    const thumbnailLocation = _findTabAndStudyOfDisplaySet(displaySetInstanceUID, tabs);
    if (!thumbnailLocation) {
      return;
    }
    const { tabName, StudyInstanceUID } = thumbnailLocation;
    setActiveTabName(tabName);
    const studyExpanded = expandedStudyInstanceUIDs.includes(StudyInstanceUID);
    if (!studyExpanded) {
      const updatedExpandedStudyInstanceUIDs = [...expandedStudyInstanceUIDs, StudyInstanceUID];
      setExpandedStudyInstanceUIDs(updatedExpandedStudyInstanceUIDs);
    }
  }, [expandedStudyInstanceUIDs, jumpToDisplaySet, tabs]);

  const activeDisplaySetInstanceUIDs = viewports.get(activeViewportId)?.displaySetInstanceUIDs;

  // --- Progress helpers/state updaters ---
  const setProgressTotal = useCallback((uid: string, total: number) => {
    setDisplaySetsLoadingState(prev => {
      const curr = prev?.[uid] ?? { total: 0, loaded: 0 };
      return { ...prev, [uid]: { ...curr, total } };
    });
  }, []);

  const incProgress = useCallback((uid: string, delta = 1) => {
    setDisplaySetsLoadingState(prev => {
      const curr = prev?.[uid] ?? { total: 0, loaded: 0 };
      return { ...prev, [uid]: { ...curr, loaded: curr.loaded + delta } };
    });
  }, []);

  const setProgressDone = useCallback((uid: string) => {
    setDisplaySetsLoadingState(prev => {
      const curr = prev?.[uid] ?? { total: 0, loaded: 0 };
      const loaded = Math.max(curr.loaded, curr.total || curr.loaded);
      return { ...prev, [uid]: { ...curr, loaded, done: true } };
    });
  }, []);

  // --- Map Cornerstone IDs -> displaySetInstanceUID ---
  function getUIDFromImageId(imageId: string | undefined) {
    if (!imageId) {
      return;
    }

    // Primary: generalSeriesModule
    let seriesUID = metaData.get('generalSeriesModule', imageId)?.seriesInstanceUID;

    // Fallback: raw DICOM tag (SeriesInstanceUID)
    if (!seriesUID) {
      const raw = metaData.get('x0020000e', imageId);
      // raw may be a string or an object { Value: '...' }
      seriesUID = typeof raw === 'string' ? raw : (raw?.Value ?? raw?.value);
    }

    if (!seriesUID) {
      return;
    }

    const ds = displaySetService
      .getActiveDisplaySets()
      .find(d => d.SeriesInstanceUID === seriesUID);
    return ds?.displaySetInstanceUID;
  }

  function getUIDFromVolumeId(volumeId: string | undefined) {
    if (!volumeId) {
      return;
    }
    const vol = cache.getVolume(volumeId);
    const firstImageId = vol?.imageIds?.[0];
    if (firstImageId) {
      const seriesUID =
        metaData.get('generalSeriesModule', firstImageId)?.seriesInstanceUID ??
        ((): string | undefined => {
          const raw = metaData.get('x0020000e', firstImageId);
          return typeof raw === 'string' ? raw : (raw?.Value ?? raw?.value);
        })();
      if (seriesUID) {
        const ds = displaySetService
          .getActiveDisplaySets()
          .find(d => d.SeriesInstanceUID === seriesUID);
        if (ds) {
          return ds.displaySetInstanceUID;
        }
      }
    }
    const byId = displaySetService.getDisplaySetByUID(volumeId);
    if (byId) {
      return byId.displaySetInstanceUID;
    }
  }

  // --- Initialize progress records and totals for visible displaySets ---
  useEffect(() => {
    const currentDisplaySets = displaySetService.activeDisplaySets;
    if (!currentDisplaySets.length) {
      return;
    }

    const mappedDisplaySets = mapDisplaySetsWithState(
      currentDisplaySets,
      displaySetsLoadingState,
      thumbnailImageSrcMap,
      viewports
    );

    if (!customMapDisplaySets) {
      sortStudyInstances(mappedDisplaySets);
    }
    setDisplaySets(mappedDisplaySets);

    // Seed indeterminate records so the bar can render immediately
    for (const ds of mappedDisplaySets) {
      const uid = ds.displaySetInstanceUID;
      if (!displaySetsLoadingState[uid]) {
        setDisplaySetsLoadingState(prev => ({ ...prev, [uid]: { total: 0, loaded: 0 } }));
      }
    }

    // Then set a real total if we can
    for (const ds of mappedDisplaySets) {
      const displaySet = displaySetService.getDisplaySetByUID(ds.displaySetInstanceUID);
      let total = 0;
      if ((displaySet as any)?.numImageFrames) {
        total = Number((displaySet as any).numImageFrames) || 0;
      } else {
        try {
          total = (dataSource.getImageIdsForDisplaySet(displaySet) || []).length;
        } catch {
          total = 0;
        }
      }
      if (total > 0) {
        setProgressTotal(ds.displaySetInstanceUID, total);
      }
    }
    // NOTE: intentionally not depending on displaySetsLoadingState to avoid loops
  }, [
    displaySetService.activeDisplaySets,
    viewports,
    thumbnailImageSrcMap,
    customMapDisplaySets,
    dataSource,
    setProgressTotal,
  ]);

  // --- Cornerstone3D event subscriptions (progress increments/completion) ---
  useEffect(() => {
    const safeImageIdFromEvent = (e: any): string | undefined => {
      const d = e?.detail ?? {};
      // Cornerstone3D loaders often put imageId here; older paths only have image
      return d.imageId ?? d.image?.imageId ?? d.image?.imageId?.toString();
    };

    const onImageLoaded = (e: any) => {
      const imageId = safeImageIdFromEvent(e);
      if (!imageId) {
        return;
      } // <- prevent "Empty imageId" calls
      const dsUID = getUIDFromImageId(imageId);
      if (dsUID) {
        // console.log('[IMAGE_LOADED]', dsUID);
        incProgress(dsUID, 1);
      }
    };

    const onVolMod = (e: any) => {
      const volumeId: string | undefined = e?.detail?.volumeId;
      if (!volumeId) {
        return;
      }
      const dsUID = getUIDFromVolumeId(volumeId);
      if (dsUID) {
        // console.log('[IMAGE_VOLUME_MODIFIED]', dsUID);
        incProgress(dsUID, 1);
      }
    };

    const onVolDone = (e: any) => {
      const volumeId: string | undefined = e?.detail?.volumeId;
      if (!volumeId) {
        return;
      }
      const dsUID = getUIDFromVolumeId(volumeId);
      if (dsUID) {
        // console.log('[IMAGE_VOLUME_LOADING_COMPLETED]', dsUID);
        setProgressDone(dsUID);
      }
    };

    eventTarget.addEventListener(Enums.Events.IMAGE_LOADED, onImageLoaded);
    eventTarget.addEventListener(Enums.Events.IMAGE_VOLUME_MODIFIED, onVolMod);
    eventTarget.addEventListener(Enums.Events.IMAGE_VOLUME_LOADING_COMPLETED, onVolDone);

    return () => {
      eventTarget.removeEventListener(Enums.Events.IMAGE_LOADED, onImageLoaded);
      eventTarget.removeEventListener(Enums.Events.IMAGE_VOLUME_MODIFIED, onVolMod);
      eventTarget.removeEventListener(Enums.Events.IMAGE_VOLUME_LOADING_COMPLETED, onVolDone);
    };
  }, [incProgress, setProgressDone]);

  const scrollHostRef = useRef<HTMLDivElement | null>(null);
  const [hostSize, setHostSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = scrollHostRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver(([entry]) => {
      const cr = entry.contentRect;
      setHostSize({ w: Math.round(cr.width), h: Math.round(cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = scrollHostRef.current;
    if (el) {
      const { clientHeight, scrollHeight } = el;
      console.log('[StudyBrowser host] clientHeight=', clientHeight, 'scrollHeight=', scrollHeight);
    }
  }, []);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <>
        <PanelStudyBrowserHeader
          viewPresets={viewPresets}
          updateViewPresetValue={updateViewPresetValue}
          actionIcons={actionIcons}
          updateActionIconValue={updateActionIconValue}
        />
        <Separator
          orientation="horizontal"
          className="bg-black"
          thickness="2px"
        />
      </>

      {/* Content area with explicit bounds */}
      <div className="flex min-h-0 flex-1">
        {/* Scrollable thumbnails wrapper fills this area */}
        <div
          className="h-full w-full pr-1"
          data-ohif-study-browser
        >
          <StudyBrowser
            tabs={tabs}
            servicesManager={servicesManager}
            activeTabName={activeTabName}
            expandedStudyInstanceUIDs={expandedStudyInstanceUIDs}
            onClickStudy={_handleStudyClick}
            onClickTab={clickedTabName => {
              setActiveTabName(clickedTabName);
            }}
            onClickUntrack={onClickUntrack}
            onClickThumbnail={() => {}}
            onDoubleClickThumbnail={onDoubleClickThumbnailHandler}
            activeDisplaySetInstanceUIDs={activeDisplaySetInstanceUIDs}
            showSettings={actionIcons.find(icon => icon.id === 'settings')?.value}
            viewPresets={viewPresets}
            ThumbnailMenuItems={MoreDropdownMenu({
              commandsManager,
              servicesManager,
              menuItemsKey: 'studyBrowser.thumbnailMenuItems',
            })}
            StudyMenuItems={MoreDropdownMenu({
              commandsManager,
              servicesManager,
              menuItemsKey: 'studyBrowser.studyMenuItems',
            })}
          />
        </div>
      </div>
      {/* Thumbnail size override (kept here for clarity; you can move to a CSS file) */}
      <style>{`
      /* Smaller thumbnails: adjust once here to affect both <img> and <canvas> */
      [data-ohif-study-browser] [id^="thumbnail-"] img,
      [data-ohif-study-browser] [id^="thumbnail-"] canvas {
        width: 92px !important;
        height: 92px !important;
        object-fit: cover;
      }

      /* Host & viewport get a fixed height */
[data-ohif-study-browser] { height: 100%; }
[data-ohif-study-browser] [data-radix-scroll-area] { height: 100%; }
[data-ohif-study-browser] [data-radix-scroll-area-viewport] {
  height: 100% !important;
  overflow: auto !important; /* let Radix do the scrolling */
}

/* 🔑 Allow the viewport's content to grow beyond 100% */
[data-ohif-study-browser] [data-radix-scroll-area-viewport] > div {
  height: auto !important;
  min-height: max-content !important;
}

/* If StudyBrowser wraps with a role="tabpanel", don't clamp it */
[data-ohif-study-browser] [role="tabpanel"] {
  height: auto !important;
  max-height: none !important;
}

/* Let the Radix ScrollArea root wrapper stop clipping */
[data-ohif-study-browser] [data-radix-scroll-area] > div {
  /* this is the wrapper that Radix gives the class "relative h-full overflow-hidden ..." */
  overflow: visible !important;
}

/* Make sure the immediate children inside the viewport can grow */
[data-ohif-study-browser] [data-radix-scroll-area-viewport] > div,
[data-ohif-study-browser] [data-radix-scroll-area-viewport] > div > div {
  height: auto !important;
  max-height: none !important;
  min-height: max-content !important;
  overflow: visible !important;
}

/* Let the viewport scroll, not clamp */
[data-ohif-study-browser] [data-radix-scroll-area-viewport] {
  height: 100% !important;
  overflow: auto !important;
}

/* The anonymous first child inside the viewport: don't fix its height */
[data-ohif-study-browser] [data-radix-scroll-area-viewport] > div:first-child {
  height: auto !important;
  min-height: max-content !important;
}

/* 🔑 The culprit: Radix content wrapper uses flex-1 (fills viewport).
   Turn it into content-sized so the grid can exceed the viewport height. */
[data-ohif-study-browser] [data-radix-scroll-area-viewport]
  > div:first-child
  > .bg-bkg-low.flex.flex-1 {
  flex: 0 0 auto !important;
  height: auto !important;
  min-height: max-content !important;
  overflow: visible !important;
}

/* (Optional) One more level down just in case the next wrapper inherits height */
[data-ohif-study-browser] [data-radix-scroll-area-viewport]
  > div:first-child
  > .bg-bkg-low.flex.flex-1
  > .flex.flex-col {
  height: auto !important;
  min-height: max-content !important;
}

/* Make any flex-1 wrapper under the viewport content-sized, not viewport-sized */
[data-ohif-study-browser] [data-radix-scroll-area-viewport] > div :where(.flex)[class*="flex-1"] {
  flex: 0 0 auto !important;
  height: auto !important;
  min-height: max-content !important;
  overflow: visible !important;
}

/* Keep viewport scrolling, not clamped */
[data-ohif-study-browser] [data-radix-scroll-area-viewport] {
  height: 100% !important;
  overflow: auto !important;
}

/* Let the anonymous first child and next wrapper grow naturally */
[data-ohif-study-browser] [data-radix-scroll-area-viewport] > div,
[data-ohif-study-browser] [data-radix-scroll-area-viewport] > div > div {
  height: auto !important;
  min-height: max-content !important;
  max-height: none !important;
  overflow: visible !important;
}

/* Radix root often has overflow hidden – open it up */
[data-ohif-study-browser] [data-radix-scroll-area] > div {
  overflow: visible !important;
}

/* Let the Radix viewport scroll normally */
[data-ohif-study-browser] [data-radix-scroll-area-viewport] {
  height: 100% !important;
  overflow: auto !important;
}

/* 🔑 Break the “100% height” chain inside the viewport */
[data-ohif-study-browser] [data-radix-scroll-area-viewport] .h-full {
  height: auto !important;
}

/* And keep descendants content-sized, not clamped */
[data-ohif-study-browser] [data-radix-scroll-area-viewport] * {
  max-height: none !important;
}
[data-ohif-study-browser] [data-radix-scroll-area] > div {
  /* Radix root wrapper sometimes clips */
  overflow: visible !important;
}
/* host & viewport sizing */
[data-ohif-study-browser] { height: 100%; }
[data-ohif-study-browser] [data-radix-scroll-area] { height: 100%; }
[data-ohif-study-browser] [data-radix-scroll-area-viewport] {
  height: 100% !important;
  overflow: auto !important; /* let the viewport scroll */
}

/* break the 100%-height chain inside the viewport */
[data-ohif-study-browser] [data-radix-scroll-area-viewport] .h-full {
  height: auto !important;
}

/* keep descendants content-sized, not clamped */
[data-ohif-study-browser] [data-radix-scroll-area-viewport] * {
  max-height: none !important;
}

/* radix root wrapper sometimes clips */
[data-ohif-study-browser] [data-radix-scroll-area] > div {
  overflow: visible !important;
}

    `}</style>
    </div>
  );
}

export default PanelStudyBrowser;

/**
 * Maps from the DataSource's format to a naturalized object
 *
 * @param {*} studies
 */
function _mapDataSourceStudies(studies) {
  return studies.map(study => {
    // TODO: Why does the data source return in this format?
    return {
      AccessionNumber: study.accession,
      StudyDate: study.date,
      StudyDescription: study.description,
      NumInstances: study.instances,
      ModalitiesInStudy: study.modalities,
      PatientID: study.mrn,
      PatientName: study.patientName,
      StudyInstanceUID: study.studyInstanceUid,
      StudyTime: study.time,
    };
  });
}

function _mapDisplaySets(displaySets, displaySetLoadingState, thumbnailImageSrcMap, viewports) {
  const thumbnailDisplaySets = [];
  const thumbnailNoImageDisplaySets = [];

  displaySets
    .filter(ds => !ds.excludeFromThumbnailBrowser)
    .forEach(ds => {
      const { thumbnailSrc, displaySetInstanceUID } = ds;
      const componentType = _getComponentType(ds);
      const array =
        componentType === 'thumbnail' ? thumbnailDisplaySets : thumbnailNoImageDisplaySets;

      const lp = displaySetLoadingState?.[displaySetInstanceUID];
      const hasTotal = !!lp && Number(lp.total) > 0;
      const isDone = !!lp?.done || (hasTotal && Number(lp.loaded) >= Number(lp.total));
      const pct = hasTotal
        ? Math.max(0, Math.min(100, Math.round((Number(lp.loaded) / Number(lp.total)) * 100)))
        : undefined;
      const isLoading = !!lp && !isDone;
      // Always-visible line: inject status into the description text
      const baseDesc = ds.SeriesDescription || '';
      const statusSuffix = isLoading
        ? pct != null
          ? ` • ${pct}%`
          : ' • Loading…'
        : isDone
          ? ' • ✓'
          : '';

      // Final, safe number for Thumbnail prop (never an object)
      const loadingProgressNumber = pct != null ? Number(pct) : undefined;
      if (
        lp &&
        typeof lp === 'object' &&
        (loadingProgressNumber == null || Number.isNaN(loadingProgressNumber))
      ) {
        // Helps find any bad cases quickly without crashing
        console.warn('Non-numeric loadingProgress prevented for', displaySetInstanceUID, lp);
      }

      array.push({
        displaySetInstanceUID,
        // 👇 This line guarantees the % shows up in the tile
        description: `${baseDesc}${statusSuffix}`,
        seriesNumber: ds.SeriesNumber,
        modality: ds.Modality,
        seriesDate: formatDate(ds.SeriesDate),
        numInstances: ds.numImageFrames,
        // Thumbnail expects a number (percentage). Only pass when we have one.
        //...(loadingProgressNumber != null ? { loadingProgress: loadingProgressNumber } : {}),
        countIcon: ds.countIcon,
        messages: ds.messages,
        StudyInstanceUID: ds.StudyInstanceUID,
        componentType,
        imageSrc: thumbnailSrc || thumbnailImageSrcMap[displaySetInstanceUID],
        dragData: {
          type: 'displayset',
          displaySetInstanceUID,
        },
        isHydratedForDerivedDisplaySet: ds.isHydrated,
      });
    });

  return [...thumbnailDisplaySets, ...thumbnailNoImageDisplaySets];
}

function _getComponentType(ds) {
  if (
    thumbnailNoImageModalities.includes(ds.Modality) ||
    ds?.unsupported ||
    ds.thumbnailSrc === null
  ) {
    return 'thumbnailNoImage';
  }

  return 'thumbnail';
}

function getImageIdForThumbnail(displaySet, imageIds) {
  let imageId;
  if ((displaySet as any).isDynamicVolume) {
    const timePoints = (displaySet as any).dynamicVolumeInfo.timePoints;
    const middleIndex = Math.floor(timePoints.length / 2);
    const middleTimePointImageIds = timePoints[middleIndex];
    imageId = middleTimePointImageIds[Math.floor(middleTimePointImageIds.length / 2)];
  } else {
    imageId = imageIds[Math.floor(imageIds.length / 2)];
  }
  return imageId;
}

function _findTabAndStudyOfDisplaySet(displaySetInstanceUID, tabs) {
  for (let t = 0; t < tabs.length; t++) {
    const { studies } = tabs[t];

    for (let s = 0; s < studies.length; s++) {
      const { displaySets } = studies[s];

      for (let d = 0; d < displaySets.length; d++) {
        const displaySet = displaySets[d];

        if (displaySet.displaySetInstanceUID === displaySetInstanceUID) {
          return {
            tabName: tabs[t].name,
            StudyInstanceUID: studies[s].studyInstanceUid,
          };
        }
      }
    }
  }
}

function createTabsWithProgress(
  primaryStudyUIDs: string[],
  studyDisplayList: Array<{
    studyInstanceUid: string;
    date: string;
    description: string;
    modalities: string[];
    numInstances: number;
  }>,
  displaySets: Array<any> // from _mapDisplaySets (includes loadingProgress)
) {
  // Build a lookup of studies we want to show (keep original fields)
  const studyMap = new Map<string, any>();
  // Seed with visible/primary study UIDs first to preserve order
  for (const uid of primaryStudyUIDs) {
    const s = studyDisplayList.find(x => x.studyInstanceUid === uid);
    if (s) {
      studyMap.set(uid, { ...s, displaySets: [] });
    }
  }
  // Then add any other studies we fetched for the patient
  for (const s of studyDisplayList) {
    if (!studyMap.has(s.studyInstanceUid)) {
      studyMap.set(s.studyInstanceUid, { ...s, displaySets: [] });
    }
  }

  // Attach display sets, PRESERVING every field (including loadingProgress)
  for (const ds of displaySets) {
    const s = studyMap.get(ds.StudyInstanceUID);
    if (s) {
      s.displaySets.push(ds);
    }
  }

  // Single "all" tab (match the stock util’s shape that StudyBrowser expects)
  return [
    {
      name: 'all',
      label: 'All',
      studies: Array.from(studyMap.values()),
    },
  ];
}
function sanitizeTabsForThumbnails(tabs) {
  // Deep-ish copy and sanitize loadingProgress on every displaySet
  return tabs.map(tab => ({
    ...tab,
    studies: tab.studies.map(study => ({
      ...study,
      displaySets: study.displaySets.map(ds => {
        const lp = (ds as any).loadingProgress;
        let loadingProgress: number | undefined = undefined;

        if (typeof lp === 'number' && Number.isFinite(lp)) {
          loadingProgress = lp;
        } else if (lp && typeof lp === 'object') {
          // If any mapper passed { total, loaded, done }, coerce to %
          const total = Number(lp.total);
          const loaded = Number(lp.loaded);
          if (total > 0 && Number.isFinite(total) && Number.isFinite(loaded)) {
            loadingProgress = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
          }
        }

        // Optional: dev-only warning to find the source
        if (lp && typeof lp === 'object' && loadingProgress === undefined) {
          // eslint-disable-next-line no-console
          console.warn('Sanitized object loadingProgress on ds', ds.displaySetInstanceUID, lp);
        }

        // Return a copy with a numeric loadingProgress (or remove it)
        const { loadingProgress: _ignored, ...rest } = ds as any;
        return loadingProgress != null ? { ...rest, loadingProgress } : rest;
      }),
    })),
  }));
}
