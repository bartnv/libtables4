let overlay = false;

function loadOverlay(data) {
  overlay = true;
  $('#overlay')
    .on('click', hideOverlay)
    .css({ opacity: 1, pointerEvents: 'auto' })
    .find('#overlay_content').html(data).activate();
}
function hideOverlay(evt) {
  if (!overlay) return;
  if (evt && (evt.target != this)) return;
  overlay = false;
  $('#overlay').css({ opacity: 0, pointerEvents: 'none' }).off('click');
  setTimeout(function() { $('#overlay_content').empty(); /* refreshAll(); */ }, 500);
}
