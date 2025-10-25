import React from 'react';
import PropTypes from 'prop-types';

import { Thumbnail } from '../Thumbnail';
import { useDynamicMaxHeight } from '../../hooks/useDynamicMaxHeight';

const ThumbnailList = ({
  thumbnails,
  onThumbnailClick,
  onThumbnailDoubleClick,
  onClickUntrack,
  activeDisplaySetInstanceUIDs = [],
  viewPreset,
  ThumbnailMenuItems,
}) => {
  const { ref, maxHeight } = useDynamicMaxHeight(thumbnails);

  const listItems =
    thumbnails?.filter(
      ({ componentType }) => componentType === 'thumbnailNoImage' || viewPreset === 'list'
    ) || [];

  const thumbnailItems =
    thumbnails?.filter(
      ({ componentType }) => componentType !== 'thumbnailNoImage' && viewPreset === 'thumbnails'
    ) || [];

  const renderProgress = (item: any) => {
    const lp = item?.loadingProgress;
    if (!lp) return null;

    const hasTotal = lp.total > 0;
    const done = !!lp.done || (hasTotal && lp.loaded >= lp.total);
    if (done) return null;

    const pct = hasTotal ? Math.min(100, Math.round((lp.loaded / lp.total) * 100)) : null;

    return (
      <div className="absolute left-2 right-2 bottom-2 h-1 overflow-hidden rounded bg-white/20">
        {hasTotal ? (
          <div
            className="h-full rounded bg-emerald-400 transition-[width] duration-150 ease-linear"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="h-full w-1/3 animate-pulse rounded bg-emerald-400" />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <div
        ref={ref}
        className="flex flex-col gap-[2px] pt-[4px] pr-[2.5px] pl-[5px] pb-[4px]"
        style={maxHeight ? { maxHeight } : undefined}
      >
        {thumbnailItems.length > 0 && (
          <div
            id="ohif-thumbnail-list"
            className="bg-bkg-low grid grid-cols-[repeat(auto-fit,_minmax(0,135px))] place-items-start gap-[4px]"
          >
            {thumbnailItems.map(item => {
              const { displaySetInstanceUID, componentType, numInstances, ...rest } = item;
              const isActive = activeDisplaySetInstanceUIDs.includes(displaySetInstanceUID);

              return (
                <div
                  key={displaySetInstanceUID}
                  className="relative"
                >
                  <Thumbnail
                    {...rest}
                    displaySetInstanceUID={displaySetInstanceUID}
                    numInstances={numInstances || 1}
                    isActive={isActive}
                    thumbnailType={componentType}
                    viewPreset="thumbnails"
                    onClick={onThumbnailClick.bind(null, displaySetInstanceUID)}
                    onDoubleClick={onThumbnailDoubleClick.bind(null, displaySetInstanceUID)}
                    onClickUntrack={onClickUntrack.bind(null, displaySetInstanceUID)}
                    ThumbnailMenuItems={ThumbnailMenuItems}
                  />
                  {renderProgress(item)}
                </div>
              );
            })}
          </div>
        )}

        {listItems.length > 0 && (
          <div
            id="ohif-thumbnail-list"
            className="bg-bkg-low grid grid-cols-[repeat(auto-fit,_minmax(0,275px))] place-items-start gap-[2px]"
          >
            {listItems.map(item => {
              const { displaySetInstanceUID, componentType, numInstances, ...rest } = item;
              const isActive = activeDisplaySetInstanceUIDs.includes(displaySetInstanceUID);

              return (
                <div
                  key={displaySetInstanceUID}
                  className="relative"
                >
                  <Thumbnail
                    {...rest}
                    displaySetInstanceUID={displaySetInstanceUID}
                    numInstances={numInstances || 1}
                    isActive={isActive}
                    thumbnailType={componentType}
                    viewPreset="list"
                    onClick={onThumbnailClick.bind(null, displaySetInstanceUID)}
                    onDoubleClick={onThumbnailDoubleClick.bind(null, displaySetInstanceUID)}
                    onClickUntrack={onClickUntrack.bind(null, displaySetInstanceUID)}
                    ThumbnailMenuItems={ThumbnailMenuItems}
                  />
                  {renderProgress(item)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

ThumbnailList.propTypes = {
  thumbnails: PropTypes.arrayOf(
    PropTypes.shape({
      displaySetInstanceUID: PropTypes.string.isRequired,
      imageSrc: PropTypes.string,
      imageAltText: PropTypes.string,
      seriesDate: PropTypes.string,
      seriesNumber: PropTypes.any,
      numInstances: PropTypes.number,
      description: PropTypes.string,
      componentType: PropTypes.any,
      isTracked: PropTypes.bool,
      dragData: PropTypes.shape({
        type: PropTypes.string.isRequired,
      }),
      // Optional: your progress object
      loadingProgress: PropTypes.shape({
        total: PropTypes.number,
        loaded: PropTypes.number,
        done: PropTypes.bool,
      }),
    })
  ),
  activeDisplaySetInstanceUIDs: PropTypes.arrayOf(PropTypes.string),
  onThumbnailClick: PropTypes.func.isRequired,
  onThumbnailDoubleClick: PropTypes.func.isRequired,
  onClickUntrack: PropTypes.func.isRequired,
  viewPreset: PropTypes.string,
  ThumbnailMenuItems: PropTypes.any,
};

export { ThumbnailList };
