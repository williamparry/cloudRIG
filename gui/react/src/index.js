import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';

const el = document.getElementById('root');

ReactDOM.render(<App />, el);

if (module.hot) {
	module.hot.accept('./components/App', () => {
		const NextApp = require('./components/App').default
		ReactDOM.render(<NextApp />, el)
	})
}