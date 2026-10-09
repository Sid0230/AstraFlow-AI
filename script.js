const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
toggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
  toggle.textContent = open ? 'Close' : 'Menu';
});
document.querySelectorAll('.nav-links a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  toggle?.setAttribute('aria-expanded', 'false');
  if (toggle) toggle.textContent = 'Menu';
}));
document.getElementById('year').textContent = new Date().getFullYear();
document.getElementById('lead-form').addEventListener('submit', event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  const form = event.currentTarget;
  button.textContent = 'Sending…';
  button.disabled = true;
  fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) })
    .then(response => { if (!response.ok) throw new Error(); button.textContent = 'Request received — thank you!'; form.reset(); })
    .catch(() => { button.textContent = 'Could not send — please try again.'; button.disabled = false; });
});

const formatCurrency = value => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0
}).format(value);

const calculator = () => {
  const people = Number(document.getElementById('people').value);
  const hours = Number(document.getElementById('hours').value);
  const rate = Number(document.getElementById('rate').value);
  const monthlyHours = people * hours * 4;
  document.getElementById('people-value').value = people;
  document.getElementById('hours-value').value = hours;
  document.getElementById('rate-value').value = formatCurrency(rate);
  document.getElementById('roi-value').textContent = formatCurrency(monthlyHours * rate);
  document.getElementById('roi-hours').textContent = `${monthlyHours.toLocaleString('en-IN')} hours could be redirected every month.`;
};
document.querySelectorAll('#calculator input').forEach(input => input.addEventListener('input', calculator));
calculator();
