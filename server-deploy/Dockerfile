FROM ros:jazzy-ros-base

RUN apt-get update && apt-get install -y --no-install-recommends \
    ros-jazzy-cartographer-ros \
    ros-jazzy-nav2-map-server \
    ros-jazzy-rosbridge-server \
    ros-jazzy-turtlebot3-cartographer \
    ros-jazzy-tf2-ros \
    ros-jazzy-tf2-geometry-msgs \
    python3-pip \
    python3-opencv \
    python3-numpy \
    && rm -rf /var/lib/apt/lists/*

COPY fastdds_udp_only.xml /usr/local/etc/fastdds_udp_only.xml
COPY frontier_explorer.py /usr/local/bin/frontier_explorer.py
COPY turtlebot3-compute-start.sh /usr/local/bin/turtlebot3-compute-start.sh
RUN chmod +x /usr/local/bin/turtlebot3-compute-start.sh /usr/local/bin/frontier_explorer.py

ENV TURTLEBOT3_MODEL=waffle_pi
ENV LDS_MODEL=LDS-03
ENV FASTRTPS_DEFAULT_PROFILES_FILE=/usr/local/etc/fastdds_udp_only.xml

ENTRYPOINT ["/usr/local/bin/turtlebot3-compute-start.sh"]
