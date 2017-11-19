import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';

const el = document.getElementById('root');

ReactDOM.render(<App />, el);

if (module.hot) {
	module.hot.accept('./App', () => {
		const NextApp = require('./App').default
		ReactDOM.render(<NextApp />, el)
	})
}