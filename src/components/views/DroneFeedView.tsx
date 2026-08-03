import React from 'react';
import { TrafficCamerasView } from './TrafficCamerasView';
import { Incident, LandmarkNode } from '../../types';

interface DroneFeedViewProps {
  incidents?: Incident[];
  landmarks?: LandmarkNode[];
  onSelectDrone?: any;
  onJumpToMap?: () => void;
}

export const DroneFeedView: React.FC<DroneFeedViewProps> = ({
  incidents = [],
  landmarks = [],
  onJumpToMap,
}) => {
  return (
    <TrafficCamerasView
      incidents={incidents}
      landmarks={landmarks}
      onJumpToMap={onJumpToMap}
    />
  );
};
