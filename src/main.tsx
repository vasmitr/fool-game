import { render } from 'solid-js/web';
import App from './App.jsx';
import './index.css';
import './controller.js';
import './player.js';

const root = document.getElementById('root');

if (root) {
  render(() => <App />, root);
} else {
  console.error("Root element not found");
}
