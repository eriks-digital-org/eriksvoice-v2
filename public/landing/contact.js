// Sends the landing page's contact form to the system (the page's own script shows the
// "thank you" and resets the form; this listener runs first, in the capture phase).
document.addEventListener(
  'submit',
  function (e) {
    var f = e.target;
    if (!f || !f.classList || !f.classList.contains('start__form')) return;
    var v = function (n) { return f.elements[n] ? String(f.elements[n].value || '').trim() : ''; };
    if (!v('name') || !v('phone')) return;
    var topics = Array.prototype.slice.call(f.querySelectorAll('input[name="topic"]:checked')).map(function (i) { return i.value; });
    fetch('/api/public/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ name: v('name'), phone: v('phone'), email: v('email'), business: v('business'), message: v('message'), topics: topics, website: v('website') }),
    }).catch(function () {});
  },
  true,
);
