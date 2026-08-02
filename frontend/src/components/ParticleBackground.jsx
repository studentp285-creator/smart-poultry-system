import { useEffect, useRef } from 'react'

const PARTICLE_COUNT = 55
const MAX_DIST       = 160   // max distance to draw a connecting line
const SPEED          = 0.38  // pixels per frame
const DOT_RADIUS     = 2.2
const CYAN           = '34, 211, 238'  // #22d3ee broken into R,G,B

function rand(min, max) { return Math.random() * (max - min) + min }

export default function ParticleBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Size canvas to window
    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Initialise particles
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x:  rand(0, canvas.width),
      y:  rand(0, canvas.height),
      vx: rand(-SPEED, SPEED),
      vy: rand(-SPEED, SPEED),
    }))

    let animId

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Move & bounce each particle
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      }

      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx   = particles[i].x - particles[j].x
          const dy   = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.35
            ctx.beginPath()
            ctx.strokeStyle = `rgba(${CYAN}, ${alpha})`
            ctx.lineWidth   = 1
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw dots with glow
      for (const p of particles) {
        // outer glow halo
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, DOT_RADIUS * 5)
        glow.addColorStop(0,   `rgba(${CYAN}, 0.35)`)
        glow.addColorStop(1,   `rgba(${CYAN}, 0)`)
        ctx.beginPath()
        ctx.arc(p.x, p.y, DOT_RADIUS * 5, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        // solid core dot
        ctx.beginPath()
        ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${CYAN}, 0.80)`
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 2 }}
    />
  )
}
