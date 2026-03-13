
const glow = document.getElementById('glow');

document.addEventListener('mousemove', (e) => {
  glow.style.left = (e.clientX-150) + "px";
  glow.style.top = (e.clientY-150) + "px";
});
