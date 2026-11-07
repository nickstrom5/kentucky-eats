// Kentucky Eats icon concepts (2026-11-06), drawn in the shared Eats Ranked style (state-prompts/ICON-STYLE.md): one flat, level,
// centred food on the flag's navy #1B365D (state-prompts/KENTUCKY_PROMPT.md), no backing shape, no text or texture, no seal, no Derby
// or team marks. Food hexes: cast iron #2B2E33, Mornay gold #E9B54A, bacon #9C3B2A, tomato #D8433A, chocolate #5A3423, pecan #A8693A,
// bread #F3E6CC, crust #D9B98A, Benedictine #B9D69A.
//   A  a Hot Brown in its cast-iron skillet, from above: golden Mornay, two bacon strips, two tomato slices
//   B  a bourbon ball: a chocolate sphere with a pecan half on top
//   C  a Benedictine finger sandwich: two slices of white bread with the pale green spread between, front view
// Usage, from ky-eats/: swift scripts/icon-concepts.swift <out dir>   -> concept-{a,b,c}-1024.png
import AppKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

func rgb(_ hex: UInt32) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: 1)
}
let NAVY: UInt32 = 0x1B365D, IRON: UInt32 = 0x2B2E33, MORNAY: UInt32 = 0xE9B54A, BACON: UInt32 = 0x9C3B2A, TOMATO: UInt32 = 0xD8433A
let CHOC: UInt32 = 0x5A3423, PECAN: UInt32 = 0xA8693A, BREAD: UInt32 = 0xF3E6CC, CRUST: UInt32 = 0xD9B98A, BENE: UInt32 = 0xB9D69A

/// A: the Hot Brown in its skillet. CoreGraphics y-up, s = canvas size. The pan sits left of centre so the handle balances it.
/// Identical to make-brand.swift's hotBrown().
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

/// B: a bourbon ball with a pecan half on top.
func bourbonBall(_ c: CGContext, _ s: CGFloat) {
    c.setFillColor(rgb(CHOC)); c.fillEllipse(in: CGRect(x: 0.18 * s, y: 0.14 * s, width: 0.64 * s, height: 0.64 * s))
    c.setFillColor(rgb(PECAN)); c.fillEllipse(in: CGRect(x: 0.33 * s, y: 0.70 * s, width: 0.34 * s, height: 0.16 * s))
}

/// C: a Benedictine finger sandwich, front view: bread, spread, bread, crusts off.
func benedictine(_ c: CGContext, _ s: CGFloat) {
    func R(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ r: CGFloat) -> CGPath {
        CGPath(roundedRect: CGRect(x: x * s, y: y * s, width: w * s, height: h * s), cornerWidth: r * s, cornerHeight: r * s, transform: nil)
    }
    c.setFillColor(rgb(BREAD))
    c.addPath(R(0.18, 0.28, 0.64, 0.16, 0.03)); c.fillPath()
    c.addPath(R(0.18, 0.56, 0.64, 0.16, 0.03)); c.fillPath()
    c.setFillColor(rgb(BENE)); c.addPath(R(0.15, 0.44, 0.70, 0.12, 0.05)); c.fillPath()
    c.setFillColor(rgb(CRUST))
    c.fill(CGRect(x: 0.18 * s, y: 0.28 * s, width: 0.64 * s, height: 0.015 * s))
    c.fill(CGRect(x: 0.18 * s, y: 0.705 * s, width: 0.64 * s, height: 0.015 * s))
}

func render(_ n: Int, _ path: String, _ draw: (CGContext, CGFloat) -> Void) {
    let ctx = CGContext(data: nil, width: n, height: n, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    ctx.setShouldAntialias(true)
    ctx.setFillColor(rgb(NAVY)); ctx.fill(CGRect(x: 0, y: 0, width: n, height: n))
    draw(ctx, CGFloat(n))
    let d = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(d, ctx.makeImage()!, nil)
    guard CGImageDestinationFinalize(d) else { fatalError("could not write \(path)") }
    print("wrote", path)
}
let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "playbook/brand"
render(1024, out + "/concept-a-1024.png", hotBrown)
render(1024, out + "/concept-b-1024.png", bourbonBall)
render(1024, out + "/concept-c-1024.png", benedictine)
