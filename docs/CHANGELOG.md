# Changelog
## 0.15.0 - 2026-05-20T22:51:48.313Z
Previous: 0.14.0
Commit: 12c9985
Changes:
- Combine RedditNSFW log export
- k
- Add direct unblur log export
- Clamp fallback layout to native height caps
- Seed collapsed fallback layout from media dimensions
- Add fallback image render-state export diagnostics
- Prefer preview image sources before direct gallery rewrites
- Recover lost fallback layers after Reddit rerenders
- Cap guessed video ladder before deeper discovery
- Expand recreation trace for pre-build skip diagnosis

## 0.14.0 - 2026-05-20T22:44:04.087Z
Previous: 0.13.4
Commit: 5f9fedd
Changes:
- k
- Add direct unblur log export
- Clamp fallback layout to native height caps
- Seed collapsed fallback layout from media dimensions
- Add fallback image render-state export diagnostics
- Prefer preview image sources before direct gallery rewrites
- Recover lost fallback layers after Reddit rerenders
- Cap guessed video ladder before deeper discovery
- Expand recreation trace for pre-build skip diagnosis
- Prefer declared video source before lower guesses

## 0.13.4 - 2026-05-20T22:34:50.580Z
Previous: 0.13.3
Commit: 06f6703
Changes:
- Clamp fallback layout to native height caps
- Seed collapsed fallback layout from media dimensions
- Add fallback image render-state export diagnostics
- Prefer preview image sources before direct gallery rewrites
- Recover lost fallback layers after Reddit rerenders
- Cap guessed video ladder before deeper discovery
- Expand recreation trace for pre-build skip diagnosis
- Prefer declared video source before lower guesses
- Yield recreation fallback back to native media
- Add exportable debug trace for recreation diagnosis

## 0.13.3 - 2026-04-04T23:08:15.310Z
Previous: 0.13.2
Commit: 5581c40
Changes:
- Seed collapsed fallback layout from media dimensions
- Add fallback image render-state export diagnostics
- Prefer preview image sources before direct gallery rewrites
- Recover lost fallback layers after Reddit rerenders
- Cap guessed video ladder before deeper discovery
- Expand recreation trace for pre-build skip diagnosis
- Prefer declared video source before lower guesses
- Yield recreation fallback back to native media
- Add exportable debug trace for recreation diagnosis
- Improve recreation source quality and permalink normalization

## 0.13.2 - 2026-04-04T23:04:04.107Z
Previous: 0.13.1
Commit: dcfcd3d
Changes:
- Add fallback image render-state export diagnostics
- Prefer preview image sources before direct gallery rewrites
- Recover lost fallback layers after Reddit rerenders
- Cap guessed video ladder before deeper discovery
- Expand recreation trace for pre-build skip diagnosis
- Prefer declared video source before lower guesses
- Yield recreation fallback back to native media
- Add exportable debug trace for recreation diagnosis
- Improve recreation source quality and permalink normalization
- Require visible native media before suppressing recreation

## 0.13.1 - 2026-04-04T22:55:45.867Z
Previous: 0.13.0
Commit: 3e36d88
Changes:
- Prefer preview image sources before direct gallery rewrites
- Recover lost fallback layers after Reddit rerenders
- Cap guessed video ladder before deeper discovery
- Expand recreation trace for pre-build skip diagnosis
- Prefer declared video source before lower guesses
- Yield recreation fallback back to native media
- Add exportable debug trace for recreation diagnosis
- Improve recreation source quality and permalink normalization
- Require visible native media before suppressing recreation
- Integrate native auto-unblur into image recreation

## 0.13.0 - 2026-04-04T22:48:04.954Z
Previous: 0.12.0
Commit: 7030ab0
Changes:
- Recover lost fallback layers after Reddit rerenders
- Cap guessed video ladder before deeper discovery
- Expand recreation trace for pre-build skip diagnosis
- Prefer declared video source before lower guesses
- Yield recreation fallback back to native media
- Add exportable debug trace for recreation diagnosis
- Improve recreation source quality and permalink normalization
- Require visible native media before suppressing recreation
- Integrate native auto-unblur into image recreation
- Suppress recreation over native revealed embeds

## 0.12.0 - 2026-04-04T22:41:04.136Z
Previous: 0.11.0
Commit: b0a609d
Changes:
- Cap guessed video ladder before deeper discovery
- Expand recreation trace for pre-build skip diagnosis
- Prefer declared video source before lower guesses
- Yield recreation fallback back to native media
- Add exportable debug trace for recreation diagnosis
- Improve recreation source quality and permalink normalization
- Require visible native media before suppressing recreation
- Integrate native auto-unblur into image recreation
- Suppress recreation over native revealed embeds
- Add gallery reconstruction support to image recreation

## 0.11.0 - 2026-04-04T22:33:18.930Z
Previous: 0.10.0
Commit: fb1ee37
Changes:
- Expand recreation trace for pre-build skip diagnosis
- Prefer declared video source before lower guesses
- Yield recreation fallback back to native media
- Add exportable debug trace for recreation diagnosis
- Improve recreation source quality and permalink normalization
- Require visible native media before suppressing recreation
- Integrate native auto-unblur into image recreation
- Suppress recreation over native revealed embeds
- Add gallery reconstruction support to image recreation
- Harden image recreation media detection and video playback recovery

## 0.10.0 - 2026-04-04T22:17:50.352Z
Previous: 0.9.0
Commit: d6a8f66
Changes:
- Prefer declared video source before lower guesses
- Yield recreation fallback back to native media
- Add exportable debug trace for recreation diagnosis
- Improve recreation source quality and permalink normalization
- Require visible native media before suppressing recreation
- Integrate native auto-unblur into image recreation
- Suppress recreation over native revealed embeds
- Add gallery reconstruction support to image recreation
- Harden image recreation media detection and video playback recovery
- Skip recreation when Reddit gallery media is already usable

## 0.9.0 - 2026-04-04T22:13:53.142Z
Previous: 0.8.0
Commit: c551877
Changes:
- Yield recreation fallback back to native media
- Add exportable debug trace for recreation diagnosis
- Improve recreation source quality and permalink normalization
- Require visible native media before suppressing recreation
- Integrate native auto-unblur into image recreation
- Suppress recreation over native revealed embeds
- Add gallery reconstruction support to image recreation
- Harden image recreation media detection and video playback recovery
- Skip recreation when Reddit gallery media is already usable
- Prefer native Reddit media before fallback recreation

## 0.8.0 - 2026-04-04T22:06:59.434Z
Previous: 0.7.0
Commit: 9380bbc
Changes:
- Add exportable debug trace for recreation diagnosis
- Improve recreation source quality and permalink normalization
- Require visible native media before suppressing recreation
- Integrate native auto-unblur into image recreation
- Suppress recreation over native revealed embeds
- Add gallery reconstruction support to image recreation
- Harden image recreation media detection and video playback recovery
- Skip recreation when Reddit gallery media is already usable
- Prefer native Reddit media before fallback recreation
- Add inline video recovery for image recreation

## 0.7.0 - 2026-04-04T21:55:21.560Z
Previous: 0.6.0
Commit: f90d0f9
Changes:
- Improve recreation source quality and permalink normalization
- Require visible native media before suppressing recreation
- Integrate native auto-unblur into image recreation
- Suppress recreation over native revealed embeds
- Add gallery reconstruction support to image recreation
- Harden image recreation media detection and video playback recovery
- Skip recreation when Reddit gallery media is already usable
- Prefer native Reddit media before fallback recreation
- Add inline video recovery for image recreation
- Fix external preview image recreation fallback

## 0.6.0 - 2026-04-04T21:42:16.310Z
Previous: 0.5.1
Commit: 5c2c244
Changes:
- Require visible native media before suppressing recreation
- Integrate native auto-unblur into image recreation
- Suppress recreation over native revealed embeds
- Add gallery reconstruction support to image recreation
- Harden image recreation media detection and video playback recovery
- Skip recreation when Reddit gallery media is already usable
- Prefer native Reddit media before fallback recreation
- Add inline video recovery for image recreation
- Fix external preview image recreation fallback
- Harden agent commit push flow

## 0.5.1 - 2026-04-04T21:31:20.851Z
Previous: 0.5.0
Commit: 79bcc57
Changes:
- Integrate native auto-unblur into image recreation
- Suppress recreation over native revealed embeds
- Add gallery reconstruction support to image recreation
- Harden image recreation media detection and video playback recovery
- Skip recreation when Reddit gallery media is already usable
- Prefer native Reddit media before fallback recreation
- Add inline video recovery for image recreation
- Fix external preview image recreation fallback
- Harden agent commit push flow
- Harden agent commit remote detection

## 0.5.0 - 2026-04-04T21:21:02.158Z
Previous: 0.4.0
Commit: bd4bfc4
Changes:
- Suppress recreation over native revealed embeds
- Add gallery reconstruction support to image recreation
- Harden image recreation media detection and video playback recovery
- Skip recreation when Reddit gallery media is already usable
- Prefer native Reddit media before fallback recreation
- Add inline video recovery for image recreation
- Fix external preview image recreation fallback
- Harden agent commit push flow
- Harden agent commit remote detection
- Fix image recreation post resolution and enforce userscript version bumps

## 0.4.0 - 2026-04-04T21:10:13.079Z
Previous: 0.3.0
Commit: 74e1e00
Changes:
- Add gallery reconstruction support to image recreation
- Harden image recreation media detection and video playback recovery
- Skip recreation when Reddit gallery media is already usable
- Prefer native Reddit media before fallback recreation
- Add inline video recovery for image recreation
- Fix external preview image recreation fallback
- Harden agent commit push flow
- Harden agent commit remote detection
- Fix image recreation post resolution and enforce userscript version bumps
- x

## 0.3.0 - 2026-04-04T20:58:07.142Z
Previous: 0.2.1
Commit: 2b676b0
Changes:
- Harden image recreation media detection and video playback recovery
- Skip recreation when Reddit gallery media is already usable
- Prefer native Reddit media before fallback recreation
- Add inline video recovery for image recreation
- Fix external preview image recreation fallback
- Harden agent commit push flow
- Harden agent commit remote detection
- Fix image recreation post resolution and enforce userscript version bumps
- x
- Rename maintained userscript files

## 0.2.1 - 2026-04-04T20:47:33.469Z
Previous: 0.2.0
Commit: 3b4212f
Changes:
- Skip recreation when Reddit gallery media is already usable
- Prefer native Reddit media before fallback recreation
- Add inline video recovery for image recreation
- Fix external preview image recreation fallback
- Harden agent commit push flow
- Harden agent commit remote detection
- Fix image recreation post resolution and enforce userscript version bumps
- x
- Rename maintained userscript files
- Rename project surface to RedditNSFW

## 0.2.0 - 2026-04-04T20:38:01.152Z
Previous: 0.1.0
Commit: 6dd3067
Changes:
- Prefer native Reddit media before fallback recreation
- Add inline video recovery for image recreation
- Fix external preview image recreation fallback
- Harden agent commit push flow
- Harden agent commit remote detection
- Fix image recreation post resolution and enforce userscript version bumps
- x
- Rename maintained userscript files
- Rename project surface to RedditNSFW
- first commit
