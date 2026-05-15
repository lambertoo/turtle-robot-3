import { useState, useEffect, useRef, useCallback } from "react";
import { Ros, Topic, Service } from "roslib";
import { addSavedMap } from "@/lib/map-storage";

export type SlamPhase = "choose" | "new-map" | "saved-maps";
export type ExploreMode = "autonomous" | "manual";

interface ExplorerStatus {
  state: "idle" | "exploring" | "backing_up" | "stopped";
  lidar_front: number;
  camera_left: boolean;
  camera_center: boolean;
  camera_right: boolean;
}

export interface UseSlamOptions {
  ros: Ros | null;
  isConnected: boolean;
  isActive: boolean;
}

export interface SlamState {
  phase: SlamPhase;
  exploreMode: ExploreMode | null;
  isMappingStarted: boolean;
  isExploring: boolean;
  isSaving: boolean;
  saveError: string | null;
}

export function useSlam({ ros, isConnected, isActive }: UseSlamOptions) {
  const [phase, setPhase] = useState<SlamPhase>("choose");
  const [exploreMode, setExploreMode] = useState<ExploreMode | null>(null);
  const [isMappingStarted, setIsMappingStarted] = useState(false);
  const [isExploring, setIsExploring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [explorerStatus, setExplorerStatus] = useState<ExplorerStatus | null>(null);

  const statusTopicRef = useRef<Topic | null>(null);

  useEffect(() => {
    if (!isActive) {
      setPhase("choose");
      setExploreMode(null);
      setIsMappingStarted(false);
      stopExploring();
    }
  }, [isActive]);

  const stopExploring = useCallback(() => {
    if (ros && isConnected) {
      const stopService = new Service({
        ros,
        name: "/autonomous_explorer/stop",
        serviceType: "std_srvs/srv/Trigger",
      });
      stopService.callService({}, () => {}, () => {});
    }

    setIsExploring(false);
    setExplorerStatus(null);

    if (statusTopicRef.current) {
      statusTopicRef.current.unsubscribe();
      statusTopicRef.current = null;
    }
  }, [ros, isConnected]);

  const startAutonomousExplore = useCallback(() => {
    if (!ros || !isConnected) return;

    const startService = new Service({
      ros,
      name: "/autonomous_explorer/start",
      serviceType: "std_srvs/srv/Trigger",
    });

    startService.callService(
      {},
      () => {
        setIsExploring(true);

        const statusTopic = new Topic({
          ros,
          name: "/autonomous_explorer/status",
          messageType: "std_msgs/msg/String",
          throttle_rate: 500,
        });

        statusTopic.subscribe((message: unknown) => {
          const rawMessage = message as { data: string };
          try {
            const parsed = JSON.parse(rawMessage.data) as ExplorerStatus;
            setExplorerStatus(parsed);

            if (parsed.state === "stopped" || parsed.state === "idle") {
              setIsExploring(false);
            }
          } catch {
            // skip malformed status messages
          }
        });

        statusTopicRef.current = statusTopic;
      },
      (error: string) => {
        console.error("[SLAM] Failed to start autonomous explorer:", error);
      }
    );
  }, [ros, isConnected]);

  const selectNewMap = useCallback((mode: ExploreMode) => {
    setPhase("new-map");
    setExploreMode(mode);
    setIsMappingStarted(false);
    setSaveError(null);
  }, []);

  const startMapping = useCallback(() => {
    setIsMappingStarted(true);
    if (exploreMode === "autonomous") {
      startAutonomousExplore();
    }
  }, [exploreMode, startAutonomousExplore]);

  const selectSavedMaps = useCallback(() => {
    setPhase("saved-maps");
    setExploreMode(null);
    stopExploring();
  }, [stopExploring]);

  const backToChoose = useCallback(() => {
    setPhase("choose");
    setExploreMode(null);
    setIsMappingStarted(false);
    stopExploring();
    setSaveError(null);
  }, [stopExploring]);

  const saveCurrentMap = useCallback((mapName: string) => {
    if (!ros || !isConnected) return;

    setIsSaving(true);
    setSaveError(null);

    const saveService = new Service({
      ros,
      name: "/map_saver/save_map",
      serviceType: "nav2_msgs/srv/SaveMap",
    });

    const filePath = `/home/ubuntu/maps/${mapName}`;

    saveService.callService(
      {
        map_topic: "/map",
        map_url: filePath,
        image_format: "pgm",
        map_mode: "trinary",
        free_thresh: 0.25,
        occupied_thresh: 0.65,
      },
      () => {
        setIsSaving(false);
        addSavedMap({
          id: `map_${Date.now()}`,
          name: mapName,
          filePath,
          savedAt: new Date().toISOString(),
        });
      },
      (error: string) => {
        setIsSaving(false);
        setSaveError(error);
      }
    );
  }, [ros, isConnected]);

  const loadSavedMap = useCallback((filePath: string) => {
    if (!ros || !isConnected) return;

    const loadService = new Service({
      ros,
      name: "/map_server/load_map",
      serviceType: "nav2_msgs/srv/LoadMap",
    });

    loadService.callService(
      { map_url: `${filePath}.yaml` },
      () => {},
      (error: string) => {
        setSaveError(error);
      }
    );
  }, [ros, isConnected]);

  return {
    slamState: { phase, exploreMode, isMappingStarted, isExploring, isSaving, saveError } as SlamState,
    explorerStatus,
    selectNewMap,
    startMapping,
    selectSavedMaps,
    backToChoose,
    saveCurrentMap,
    loadSavedMap,
    stopExploring,
  };
}
