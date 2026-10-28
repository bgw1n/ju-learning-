/* Dorian's home (placeholder): a spoken greeting, big pictures, tap-only. No reading needed. */
(function () {
  const GREETING = 'Hi Dorian! I am so happy you are here. Your games are coming soon!';
  if (JU.auth.role() === 'parent') document.getElementById('parent-bar').hidden = false;
  const hear = document.getElementById('hear');
  function speak() { try { return JU.speech.say(GREETING); } catch (e) { /* no voice on this device: the pictures still work */ } }
  hear.addEventListener('click', speak);
  document.querySelector('.kid-stage').addEventListener('click', speak);
  document.getElementById('bye').addEventListener('click', () => JU.auth.logout());
  speak();       // some browsers wait for a tap before they will talk; the big speaker button always works
})();
