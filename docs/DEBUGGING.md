# Debugging

## Direct unblur script
- Debug output is gated by local storage key `reddit-unblur-debug`.
- Console prefix: `[Reddit Unblur]`
- Runtime toggles:
- `Alt+U` toggles the script on or off
- `Alt+Shift+U` toggles debug logging

## External reconstruction script
- Debug output is gated by the local `DEBUG` constant.
- Console prefix: `[Reddit External Unblur]`
- Main failure points:
- post JSON fetch failure
- media URL extraction failure
- incorrect rewriting of `external-preview.redd.it` URLs into invalid `i.redd.it` URLs
- preload failure
- Reddit DOM changes that prevent overlay attachment

## First debugging pass
- Confirm which script line is responsible for the current issue.
- Check whether Reddit still renders a `shreddit-blurred-container`.
- Check whether the post JSON still exposes the needed media URLs.
- Check browser console output before changing logic.
