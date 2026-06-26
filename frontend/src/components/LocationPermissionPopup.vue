<template>
  <Teleport to="body">
    <Transition name="loc-fade">
      <div v-if="visible" class="loc-backdrop" @click.self="dismiss">
        <div class="loc-card">
          <!-- Header -->
          <div class="loc-header">
            <div class="loc-radar-ring loc-ring-3" />
            <div class="loc-radar-ring loc-ring-2" />
            <div class="loc-radar-ring loc-ring-1" />
            <div class="loc-radar-sweep" />
            <div class="loc-radar-dot" />
            <div class="loc-radar-blip loc-blip-a" />
            <div class="loc-radar-blip loc-blip-b" />
            <div class="loc-radar-blip loc-blip-c" />
          </div>

          <!-- Body -->
          <div class="loc-body">
            <p class="loc-app-label">ERP Next</p>
            <h2 class="loc-title">Allow Location Access</h2>
            <p class="loc-desc">
              Your team uses live location to coordinate field employees, track
              coverage, and stay in sync on the radar map.
            </p>

            <ul class="loc-list">
              <li>
                <span class="loc-list-icon loc-icon-green">
                  <svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Used only while the app is open
              </li>
              <li>
                <span class="loc-list-icon loc-icon-green">
                  <svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Visible only to your workspace admins
              </li>
              <li>
                <span class="loc-list-icon loc-icon-green">
                  <svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                Never shared outside your organisation
              </li>
            </ul>
          </div>

          <!-- Footer -->
          <div class="loc-footer">
            <button class="loc-btn-ghost" @click="dismiss">Not Now</button>
            <button class="loc-btn-primary" @click="allow">
              <svg class="loc-btn-icon" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5C5.51 1.5 3.5 3.51 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5c0-2.49-2.01-4.5-4.5-4.5zm0 6.1a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2z" fill="currentColor"/>
              </svg>
              Allow Location
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from "vue"

const STORAGE_KEY = "loc_permission_granted"

const visible = ref(false)

onMounted(() => {
  if (localStorage.getItem(STORAGE_KEY) === "1") {
    startTracking()
  } else if (!localStorage.getItem("loc_permission_shown")) {
    visible.value = true
  }
})

function dismiss() {
  localStorage.setItem("loc_permission_shown", "1")
  visible.value = false
}

function allow() {
  localStorage.setItem("loc_permission_shown", "1")
  localStorage.setItem(STORAGE_KEY, "1")
  visible.value = false
  startTracking()
}

function startTracking() {
  if (!navigator.geolocation) return
  navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords
      fetch("/api/method/erp_next_custom.erp_next_custom.api.update_location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Frappe-CSRF-Token": window.csrf_token || "",
        },
        body: JSON.stringify({ lat, lng, accuracy }),
      }).catch(() => {})
    },
    () => {},
    { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 }
  )
}
</script>

<style scoped>
/* ── Backdrop ──────────────────────────────────────────────── */
.loc-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
}

/* ── Card ──────────────────────────────────────────────────── */
.loc-card {
  width: 360px;
  background: #ffffff;
  border-radius: 18px;
  border: 1.5px solid #e8e8f0;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.22);
  overflow: hidden;
}

/* ── Radar Header ──────────────────────────────────────────── */
.loc-header {
  position: relative;
  height: 160px;
  background: linear-gradient(135deg, #1e3a8a 0%, #2d52a8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Rings */
.loc-radar-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.18);
}
.loc-ring-1 { width: 80px;  height: 80px; }
.loc-ring-2 { width: 130px; height: 130px; }
.loc-ring-3 { width: 190px; height: 190px; border-color: rgba(255,255,255,0.08); }

/* Cross-hairs */
.loc-header::before,
.loc-header::after {
  content: "";
  position: absolute;
  background: rgba(255, 255, 255, 0.1);
}
.loc-header::before { width: 1px; height: 100%; left: 50%; }
.loc-header::after  { height: 1px; width: 100%; top: 50%; }

/* Sweep */
.loc-radar-sweep {
  position: absolute;
  width: 65px;
  height: 65px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    rgba(37, 99, 235, 0) 0%,
    rgba(37, 99, 235, 0.55) 25%,
    rgba(37, 99, 235, 0) 30%
  );
  animation: loc-sweep 3s linear infinite;
  transform-origin: center;
}

@keyframes loc-sweep {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* Centre dot */
.loc-radar-dot {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 8px 3px rgba(255, 255, 255, 0.4);
}

/* Blips */
.loc-radar-blip {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #60a5fa;
  box-shadow: 0 0 6px 2px rgba(96, 165, 250, 0.7);
  animation: loc-blip-pulse 2s ease-in-out infinite;
}
.loc-blip-a { top: 38%;  left: 62%; animation-delay: 0s;    }
.loc-blip-b { top: 60%;  left: 38%; animation-delay: 0.7s;  }
.loc-blip-c { top: 30%;  left: 40%; animation-delay: 1.4s;  }

@keyframes loc-blip-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50%       { opacity: 1;   transform: scale(1.2); }
}

/* ── Body ──────────────────────────────────────────────────── */
.loc-body {
  padding: 20px 22px 16px;
}

.loc-app-label {
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #64748b;
  margin: 0 0 4px;
}

.loc-title {
  font-size: 17px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 10px;
}

.loc-desc {
  font-size: 13px;
  color: #374151;
  line-height: 1.55;
  margin: 0 0 14px;
}

.loc-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.loc-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: #374151;
}

.loc-list-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.loc-icon-green {
  background: #f0fdf4;
  color: #16a34a;
}

.loc-list-icon svg {
  width: 11px;
  height: 11px;
}

/* ── Footer ────────────────────────────────────────────────── */
.loc-footer {
  display: flex;
  gap: 8px;
  padding: 14px 22px 18px;
  border-top: 1.5px solid #e8e8f0;
}

.loc-btn-ghost {
  flex: 1;
  height: 36px;
  border: 1.5px solid #e8e8f0;
  border-radius: 99px;
  background: #ffffff;
  color: #374151;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s;
}
.loc-btn-ghost:hover { background: #f8fafc; }

.loc-btn-primary {
  flex: 2;
  height: 36px;
  border: none;
  border-radius: 99px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: opacity 0.12s;
}
.loc-btn-primary:hover { opacity: 0.9; }

.loc-btn-icon {
  width: 14px;
  height: 14px;
}

/* ── Transition ────────────────────────────────────────────── */
.loc-fade-enter-active,
.loc-fade-leave-active {
  transition: opacity 0.2s ease;
}
.loc-fade-enter-active .loc-card,
.loc-fade-leave-active .loc-card {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.loc-fade-enter-from,
.loc-fade-leave-to {
  opacity: 0;
}
.loc-fade-enter-from .loc-card,
.loc-fade-leave-to .loc-card {
  transform: scale(0.94) translateY(8px);
  opacity: 0;
}
</style>
