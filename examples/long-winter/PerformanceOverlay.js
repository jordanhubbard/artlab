import { ACTS, DURATION } from './score.js'

const GREETINGS = 'GREETINGS TO THE DREAMERS OF THE NORTH · FAIRLIGHT · KEFRENS · SILENTS · SPACEBALLS · RAZOR 1911 · AND EVERYONE STILL MAKING MACHINES SING · '

export class PerformanceOverlay {
  constructor(parent, onStart) {
    this.root = document.createElement('div')
    this.root.dataset.longWinter = ''
    this.root.innerHTML = `
      <div class="lw-title"><small>A REALTIME NORTHERN ODYSSEY</small><strong>LONG WINTER</strong><span>N O R T H E R N &nbsp; L I G H T</span><p>Nine movements in snow, silver and light</p></div>
      <button class="lw-watch" type="button">WATCH NORTHERN LIGHT</button>
      <div class="lw-hud"><span class="lw-act">ACT I / IX</span><span class="lw-part">BLUE HOUR</span><span class="lw-song">♫ BLÅ TIMMEN</span><span class="lw-time">00:00</span></div>
      <div class="lw-palette"></div>
      <div class="lw-tracker" hidden></div>
      <div class="lw-greetings"><span>${GREETINGS.repeat(2)}</span></div>
      <nav><button class="lw-fullscreen" type="button">FULLSCREEN</button><button class="lw-score" type="button">SCORE</button><a class="lw-source" target="_blank" rel="noreferrer">SOURCE ↗</a></nav>
      <div class="lw-credits" hidden></div>`
    this.style()
    parent.appendChild(this.root)
    this.watch = this.root.querySelector('.lw-watch')
    this.title = this.root.querySelector('.lw-title')
    this.act = this.root.querySelector('.lw-act')
    this.part = this.root.querySelector('.lw-part')
    this.song = this.root.querySelector('.lw-song')
    this.time = this.root.querySelector('.lw-time')
    this.palette = this.root.querySelector('.lw-palette')
    this.tracker = this.root.querySelector('.lw-tracker')
    this.source = this.root.querySelector('.lw-source')
    this.credits = this.root.querySelector('.lw-credits')
    this.watch.addEventListener('click', async () => {
      if (this.watch.disabled) return
      this.watch.disabled = true
      this.watch.textContent = 'LOADING SONG 01…'
      await onStart()
      this.watch.remove()
      this.title.classList.add('playing')
      this.root.classList.add('started')
    })
    this.root.querySelector('.lw-score').addEventListener('click', () => { this.tracker.hidden = !this.tracker.hidden })
    this.root.querySelector('.lw-fullscreen').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
      else if (parent.requestFullscreen) parent.requestFullscreen().catch(() => {})
      else document.getElementById('btn-fullscreen')?.click()
    })
  }

  style() {
    const style = document.createElement('style')
    style.textContent = `
      [data-long-winter]{position:absolute;inset:0;overflow:hidden;z-index:80;pointer-events:none;color:#d9f8ff;font:11px/1.5 monospace;letter-spacing:.16em;text-shadow:0 1px 8px #020817}
      [data-long-winter] .lw-title{position:absolute;left:50%;top:39%;transform:translate(-50%,-50%);text-align:center;transition:opacity 1.5s;white-space:nowrap}
      [data-long-winter] .lw-title.playing{opacity:0}[data-long-winter] small,[data-long-winter] span{display:block;color:#70a9bd}
      [data-long-winter] strong{display:block;font:200 clamp(28px,5vw,74px)/1.4 system-ui,sans-serif;letter-spacing:.2em;color:#e2f0ee;margin:.15em 0;text-shadow:0 2px 40px #061528}
      [data-long-winter] .lw-title small{font-size:9px;letter-spacing:.35em;color:#a3c5cb}[data-long-winter] .lw-title p{font:italic 15px Georgia,serif;color:#bbcecf;margin-top:22px;letter-spacing:.04em}
      [data-long-winter] button,[data-long-winter] a{pointer-events:auto;background:rgba(4,12,28,.88);border:1px solid #397b99;color:#caf6ff;padding:9px 15px;font:10px monospace;letter-spacing:.15em;text-decoration:none;cursor:pointer}
      [data-long-winter] .lw-watch{position:absolute;left:50%;top:63%;transform:translateX(-50%);padding:15px 28px;border-color:#7ba6ae;color:#deeeee;background:rgba(4,15,25,.65);backdrop-filter:blur(12px)}
      [data-long-winter] .lw-hud{position:absolute;left:18px;top:16px;border-left:2px solid #20e0d0;padding-left:10px}[data-long-winter] .lw-hud span{margin-bottom:2px}
      [data-long-winter] .lw-act{color:#8fc4ce}[data-long-winter] .lw-part{color:#e8faff;font-size:13px}[data-long-winter] .lw-song{color:#c7b99b}
      [data-long-winter] .lw-palette{position:absolute;right:15px;top:17px;width:70px;height:5px;background:linear-gradient(90deg,#08e0e8 0 20%,#7146ed 20% 40%,#ed369b 40% 60%,#ff8d2c 60% 80%,#52ee89 80%)}
      [data-long-winter] nav{position:absolute;right:14px;bottom:31px;display:flex;gap:7px}
      [data-long-winter] .lw-tracker{position:absolute;right:14px;bottom:75px;width:268px;padding:13px;background:rgba(3,9,24,.92);white-space:pre;border-left:2px solid #ff3e9d}
      [data-long-winter] .lw-greetings{display:none;position:absolute;left:0;right:0;bottom:0;height:19px;overflow:hidden;background:#070d25;border-top:1px solid #663db7;color:#50e6da;white-space:nowrap}
      [data-long-winter].started .lw-greetings{display:block}[data-long-winter] .lw-greetings span{display:inline-block;color:#50e6da;animation:lw-scroll 30s linear infinite;line-height:19px}
      [data-long-winter] .lw-credits{position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);padding:24px;min-width:330px;text-align:center;background:rgba(3,9,24,.94);border:1px solid #7849da}
      @keyframes lw-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
    `
    this.root.appendChild(style)
  }

  update(position, activity, metrics) {
    this.act.textContent = `ACT ${roman(position.actIndex + 1)} / IX`
    this.part.textContent = position.act.name.replace(/^.+? · /, '')
    this.song.textContent = `♫ ${position.act.song.title} · ${position.act.song.voice.toUpperCase()} LEAD`
    this.time.textContent = `${clock(position.seconds)} / ${clock(DURATION)}`
    this.source.href = `https://github.com/jordanhubbard/artlab/blob/main/examples/long-winter/${position.act.source}`
    const meter = value => `${'█'.repeat(Math.round(value * 8))}${'·'.repeat(8 - Math.round(value * 8))}`
    this.tracker.textContent = [
      `SONG ${String(position.actIndex + 1).padStart(2, '0')}  ${position.act.song.title}`,
      `PATTERN ${String(position.pattern).padStart(2, '0')}  ROW ${String(position.row).padStart(2, '0')}`,
      `MELODY  ${meter(activity.melody)}`,
      `CHORD   ${meter(activity.chord)}`,
      `BASS    ${meter(activity.bass)}`,
      `DRUMS   ${meter(activity.drums)}`,
      '',
      `${position.act.endBar - position.act.startBar} BARS · ${position.act.song.voice.toUpperCase()}`,
      `SOURCE  ${position.act.source}`,
    ].join('\n')
    if (position.seconds >= DURATION) this.showCredits(metrics)
  }

  showCredits(metrics) {
    const platform = navigator.userAgentData?.platform || navigator.platform || 'browser device'
    const browser = navigator.userAgent.match(/(Firefox|Chrome|Safari)\/[\d.]+/)?.[0] || 'browser'
    this.credits.hidden = false
    this.credits.innerHTML = `<strong>FIRST LIGHT</strong><p>Nine songs for the northern night<br>Sculpted fjords · reflected aurora · silver light sculptures<br>For the artists who made the Amiga dream</p><p>${metrics.drawCalls} draw calls · ${metrics.p50.toFixed(1)} ms p50 · ${metrics.p95.toFixed(1)} ms p95</p><p>${metrics.width}×${metrics.height} · ${metrics.path}<br>${platform} · ${browser} · measured live</p><p>${ACTS.length} ACTS · MADE WITH ARTLAB</p>`
  }

  dispose() { this.root.remove() }
}

function clock(seconds) {
  const whole = Math.floor(seconds)
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

function roman(value) { return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][value - 1] }
