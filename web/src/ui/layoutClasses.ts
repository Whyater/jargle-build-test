// has-tabs reserves room at the bottom of the page for the fixed tab bar.
// focus-mode marks a game screen (any route with no tab): no nav and no rail, just the game,
// centered and a little bigger on wide screens (see desktop.css). It is on <html> too, so wide
// screens can scale a game up by its root font size.
export function setLayoutClasses(hasTab: boolean): void {
  document.body.classList.toggle('has-tabs', hasTab);
  document.body.classList.toggle('focus-mode', !hasTab);
  document.documentElement.classList.toggle('focus-mode', !hasTab);
}
