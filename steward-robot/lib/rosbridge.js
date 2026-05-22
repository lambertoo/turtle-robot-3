/**
 * Shared rosbridge helpers for steward-robot steps.
 * Wraps roslibjs (loaded via CDN) with simple connect/disconnect/subscribe/publish.
 */

const ROSLIB_CDN = "https://cdn.jsdelivr.net/npm/roslib@1/build/roslib.min.js";

function loadRosLib(callback) {
  if (window.ROSLIB) { callback(); return; }
  const script = document.createElement("script");
  script.src = ROSLIB_CDN;
  script.onload = callback;
  document.head.appendChild(script);
}

class RosBridge {
  constructor() {
    this.ros = null;
    this.onConnect = null;
    this.onDisconnect = null;
    this.onError = null;
    this.isConnected = false;
    this._connecting = false;
    this._lastUrl = null;
  }

  connect(url) {
    if (this._connecting) return;
    this._connecting = true;
    this._lastUrl = url;

    loadRosLib(() => {
      if (this.ros) {
        try { this.ros.close(); } catch(_) {}
        this.ros = null;
      }
      this.isConnected = false;

      this.ros = new ROSLIB.Ros({ url });

      this.ros.on("connection", () => {
        this._connecting = false;
        this.isConnected = true;
        if (this.onConnect) this.onConnect();
      });

      this.ros.on("close", () => {
        this._connecting = false;
        this.isConnected = false;
        if (this.onDisconnect) this.onDisconnect();
      });

      this.ros.on("error", (e) => {
        this._connecting = false;
        this.isConnected = false;
        if (this.onError) this.onError(e);
      });
    });
  }

  disconnect() {
    this._connecting = false;
    this.isConnected = false;
    if (this.ros) {
      try { this.ros.close(); } catch(_) {}
      this.ros = null;
    }
  }

  subscribe(topic, type, callback, throttle = 0) {
    if (!this.ros) return null;
    const t = new ROSLIB.Topic({ ros: this.ros, name: topic, messageType: type, throttle_rate: throttle });
    t.subscribe(callback);
    return t;
  }

  publish(topic, type, message) {
    if (!this.ros) return;
    const t = new ROSLIB.Topic({ ros: this.ros, name: topic, messageType: type });
    t.publish(new ROSLIB.Message(message));
  }

  callService(name, type, request, onSuccess, onError) {
    if (!this.ros) return;
    const svc = new ROSLIB.Service({ ros: this.ros, name, serviceType: type });
    svc.callService(new ROSLIB.ServiceRequest(request), onSuccess, onError);
  }

  getTopics(callback) {
    if (!this.ros) return;
    this.ros.getTopics(callback);
  }
}

window.RosBridge = RosBridge;
