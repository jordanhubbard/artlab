import { DURATION } from './score.js'

export class PerformanceOverlay {
  constructor(parent, onStart) {
    this.root = document.createElement('div')
    this.root.dataset.longWinter = ''
    this.root.innerHTML = `
      <div class="lw-title"><small>ARTLAB PRESENTS</small><strong>LONG WINTER</strong><span>an original browser demoscene</span></div>
      <button class="lw-watch" type="button">WATCH</button>
      <div class="lw-hud"><span class="lw-part">INVITATION</span><span class="lw-time">00:00</span></div>
      <div class="lw-tracker" hidden></div>
      <nav><button class="lw-score" type="button">EXPLORE THE SCORE</button><a class="lw-source" target="_blank" rel="noreferrer">OPEN THIS PART ↗</a></nav>
      <div class="lw-credits" hidden></div>`
    this.style()
    parent.appendChild(this.root)
    this.watch = this.root.querySelector('.lw-watch')
    this.title = this.root.querySelector('.lw-title')
    this.part = this.root.querySelector('.lw-part')
    this.time = this.root.querySelector('.lw-time')
    this.tracker = this.root.querySelector('.lw-tracker')
    this.source = this.root.querySelector('.lw-source')
    this.credits = this.root.querySelector('.lw-credits')
    this.watch.addEventListener('click', async () => {
      if (this.watch.disabled) return
      this.watch.disabled = true
      this.watch.textContent = 'TUNING…'
      await onStart()
      this.watch.remove()
      this.title.classList.add('playing')
    })
    this.root.querySelector('.lw-score').addEventListener('click', () => { this.tracker.hidden = !this.tracker.hidden })
  }

  style() {
    const style = document.createElement('style')
    style.textContent = `
      [data-long-winter]{position:absolute;inset:0;z-index:80;pointer-events:none;color:#eef6f7;font:11px/1.5 monospace;letter-spacing:.16em;text-shadow:0 1px 8px #08131f}
      [data-long-winter] .lw-title{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);text-align:center;transition:opacity 1s}
      [data-long-winter] .lw-title.playing{opacity:0}[data-long-winter] small,[data-long-winter] span{display:block;color:#9ab2c2}
      [data-long-winter] strong{display:block;font-size:clamp(27px,5vw,58px);letter-spacing:.34em;color:#f4f5ee;margin:.2em 0}
      [data-long-winter] button,[data-long-winter] a{pointer-events:auto;background:rgba(9,22,35,.8);border:1px solid #7897a8;color:#e8f0ee;padding:9px 15px;font:10px monospace;letter-spacing:.15em;text-decoration:none;cursor:pointer}
      [data-long-winter] .lw-watch{position:absolute;left:50%;top:59%;transform:translateX(-50%);padding:13px 35px;border-color:#ffb43c;color:#ffd690}
      [data-long-winter] .lw-hud{position:absolute;left:18px;top:16px}[data-long-winter] .lw-hud span{margin-bottom:4px}
      [data-long-winter] nav{position:absolute;right:14px;bottom:14px;display:flex;gap:7px}
      [data-long-winter] .lw-tracker{position:absolute;right:14px;bottom:58px;width:245px;padding:13px;background:rgba(5,14,24,.88);white-space:pre;border-left:2px solid #ffb43c}
      [data-long-winter] .lw-credits{position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);padding:24px;min-width:300px;text-align:center;background:rgba(5,14,24,.9);border:1px solid #7897a8}
    `
    this.root.appendChild(style)
  }

  update(position, activity, metrics) {
    this.part.textContent = `P${String(position.pattern).padStart(2, '0')} · ${position.part.name}`
    this.time.textContent = `${clock(position.seconds)} / ${clock(DURATION)}`
    this.source.href = `https://github.com/jordanhubbard/artlab/blob/main/examples/long-winter/${position.part.source}`
    const meter = value => `${'█'.repeat(Math.round(value * 8))}${'·'.repeat(8 - Math.round(value * 8))}`
    this.tracker.textContent = [
      `PATTERN ${String(position.pattern).padStart(2, '0')}  ROW ${String(position.row).padStart(2, '0')}`,
      `MELODY  ${meter(activity.melody)}`,
      `CHORD   ${meter(activity.chord)}`,
      `BASS    ${meter(activity.bass)}`,
      `DRUMS   ${meter(activity.drums)}`,
      '',
      `${position.part.startBar}–${position.part.endBar} BARS`,
      `SOURCE  ${position.part.source}`,
    ].join('\n')
    if (position.seconds >= DURATION) {
      const platform = navigator.userAgentData?.platform || navigator.platform || 'browser device'
      const browser = navigator.userAgent.match(/(Firefox|Chrome|Safari)\/[\d.]+/)?.[0] || 'browser'
      this.credits.hidden = false
      this.credits.innerHTML = `<strong>THE LAMP IS STILL ON</strong><p>Original score + procedural geometry by Artlab</p><p>${metrics.instances.toLocaleString()} / 1,400 instances · 0 external assets<br>${metrics.drawCalls} draw calls · ${metrics.p50.toFixed(1)} ms p50 · ${metrics.p95.toFixed(1)} ms p95</p><p>${metrics.width}×${metrics.height} · ${metrics.path}<br>${platform} · ${browser} · measured live</p>`
    }
  }

  dispose() { this.root.remove() }
}

function clock(seconds) {
  const whole = Math.floor(seconds)
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}
