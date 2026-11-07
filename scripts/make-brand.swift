// Kentucky Eats brand (final: Nick's decision 2026-11-07): the app icon is concept A of
// scripts/icon-concepts.swift, a Hot Brown in its cast-iron skillet, on the flag's navy; the shared Eats Ranked icon style,
// state-prompts/ICON-STYLE.md, no backing shape. No seal, no Derby or team marks, no drumstick (KFC).
// Usage, from ky-eats/: swift scripts/make-brand.swift   -> KentuckyEats/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png,
// docs/ favicons and touch icons, docs/og.png. scripts/make-site.py draws the same mark as its inline SVG: change both together.
import AppKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

func rgb(_ hex: UInt32) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: 1)
}
let NAVY: UInt32 = 0x1B365D, IRON: UInt32 = 0x2B2E33, MORNAY: UInt32 = 0xE9B54A, BACON: UInt32 = 0x9C3B2A, TOMATO: UInt32 = 0xD8433A
let GREEN: UInt32 = 0x3D6B4A, CREAM: UInt32 = 0xF4EFE4, INK: UInt32 = 0x1A1A1A

/// A: the Hot Brown in its skillet. CoreGraphics y-up, s = canvas size. Identical to icon-concepts.swift's concept A.
func hotBrown(_ c: CGContext, _ s: CGFloat) {
    let cx = 0.39 * s, cy = 0.5 * s, r = 0.25 * s
    c.setFillColor(rgb(IRON))
    c.addPath(CGPath(roundedRect: CGRect(x: cx + r * 0.80, y: cy - 0.05 * s, width: 0.27 * s, height: 0.10 * s), cornerWidth: 0.05 * s,
                     cornerHeight: 0.05 * s, transform: nil)); c.fillPath()                        // the handle, level
    c.fillEllipse(in: CGRect(x: cx - r, y: cy - r, width: 2 * r, height: 2 * r))                // the pan
    let m = r * 0.80
    c.setFillColor(rgb(MORNAY)); c.fillEllipse(in: CGRect(x: cx - m, y: cy - m, width: 2 * m, height: 2 * m))   // the Mornay
    c.setFillColor(rgb(BACON))
    for dy in [-0.085, 0.085] {                                                                   // two bacon strips, level
        c.addPath(CGPath(roundedRect: CGRect(x: cx - 0.15 * s, y: cy + CGFloat(dy) * s - 0.03 * s, width: 0.30 * s, height: 0.06 * s),
                         cornerWidth: 0.03 * s, cornerHeight: 0.03 * s, transform: nil)); c.fillPath()
    }
    c.setFillColor(rgb(TOMATO))
    for dx in [-0.075, 0.075] {                                                                   // two tomato slices between them
        c.fillEllipse(in: CGRect(x: cx + CGFloat(dx) * s - 0.04 * s, y: cy - 0.04 * s, width: 0.08 * s, height: 0.08 * s))
    }
}

func render(_ n: Int, _ path: String, background: Bool) {
    let ctx = CGContext(data: nil, width: n, height: n, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: background ? CGImageAlphaInfo.noneSkipLast.rawValue : CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.setShouldAntialias(true)
    if background { ctx.setFillColor(rgb(NAVY)); ctx.fill(CGRect(x: 0, y: 0, width: n, height: n)) }
    hotBrown(ctx, CGFloat(n))
    let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(d, ctx.makeImage()!, nil)
    guard CGImageDestinationFinalize(d) else { fatalError("could not write \(path)") }
    print("wrote", path)
}
render(1024, "KentuckyEats/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png", background: true)
try? FileManager.default.createDirectory(atPath: "docs", withIntermediateDirectories: true)
for (n, name) in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png"), (32, "favicon-32.png")] {
    render(n, "docs/" + name, background: true)
}

/// The share image (1200 x 630): navy, the Hot Brown at the left, the name and tagline at the right, and the app's header band along
/// the bottom: a four-plank fence over two bluegrass hills on a navy baseline, on cream (Theme.swift's Stripes).
func og(_ path: String) {
    let W = 1200, H = 630
    let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    ctx.setShouldAntialias(true)
    ctx.setFillColor(rgb(NAVY)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
    let band: CGFloat = 70, base: CGFloat = 14, w = CGFloat(W)
    ctx.setFillColor(rgb(CREAM)); ctx.fill(CGRect(x: 0, y: 0, width: w, height: band))
    for (i, (crest, amp)) in [(0.35, 0.95), (0.75, 0.70)].enumerated() {
        let p = CGMutablePath(); p.move(to: CGPoint(x: 0, y: base))
        for k in 0...60 {
            let x = CGFloat(k) / 60
            let rise = CGFloat(amp) * (0.55 + 0.45 * cos((x - CGFloat(crest)) * .pi * 1.6))
            p.addLine(to: CGPoint(x: x * w, y: base + (band - base) * min(1, rise)))
        }
        p.addLine(to: CGPoint(x: w, y: base)); p.closeSubpath()
        ctx.setFillColor(rgb(GREEN).copy(alpha: [0.45, 1.0][i])!); ctx.addPath(p); ctx.fillPath()
    }
    ctx.setFillColor(rgb(INK))
    let top = band - (band - base) * 0.30, railH: CGFloat = 4
    for r in 0..<4 { ctx.fill(CGRect(x: 0, y: top - CGFloat(r) * (top - base) / 4.2 - railH, width: w, height: railH)) }
    var x: CGFloat = 20
    while x < w { ctx.fill(CGRect(x: x, y: base, width: 8, height: top - base + railH)); x += 108 }
    ctx.setFillColor(rgb(NAVY)); ctx.fill(CGRect(x: 0, y: 0, width: w, height: base))
    ctx.saveGState(); ctx.translateBy(x: 30, y: 90); hotBrown(ctx, 520); ctx.restoreGState()
    let ns = NSGraphicsContext(cgContext: ctx, flipped: false)
    NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = ns
    let title = NSFont(name: "AvenirNextCondensed-Heavy", size: 92) ?? NSFont.boldSystemFont(ofSize: 80)
    let sub = NSFont(name: "AvenirNextCondensed-DemiBold", size: 34) ?? NSFont.boldSystemFont(ofSize: 30)
    NSAttributedString(string: "KENTUCKY", attributes: [.font: title, .foregroundColor: NSColor.white]).draw(at: NSPoint(x: 590, y: 370))
    NSAttributedString(string: "EATS", attributes: [.font: title, .foregroundColor: NSColor.white]).draw(at: NSPoint(x: 590, y: 276))
    NSAttributedString(string: "HOT BROWNS, BURGOO & BOURBON", attributes: [.font: sub, .foregroundColor: NSColor(srgbRed: 0.902, green: 0.659, blue: 0.090, alpha: 1)]).draw(at: NSPoint(x: 594, y: 226))
    NSGraphicsContext.restoreGraphicsState()
    let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(d, ctx.makeImage()!, nil)
    guard CGImageDestinationFinalize(d) else { fatalError("could not write \(path)") }
    print("wrote", path)
}
og("docs/og.png")
