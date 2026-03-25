import { render } from 'solid-js/web';
import App from './App.jsx';
import './index.css';
import './player.js';
import './controller.js';
import './test-bridge.js';

const root = document.getElementById('root');

if (root) {
  render(() => <App />, root);
} else {
  console.error("Root element not found");
}
