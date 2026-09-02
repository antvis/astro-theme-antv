import { message } from './message.js';

const container: HTMLElement | null = document.querySelector('#container');
if (!container) throw new Error('Demo container is missing.');
container.textContent = message;
