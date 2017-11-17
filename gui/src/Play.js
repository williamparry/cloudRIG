import React, { Component } from 'react';
import { Button, Message } from 'semantic-ui-react'

const { ipcRenderer } = window.require('electron');

class Play extends Component {

	constructor() {

		super();

		this.state = {
			isStarting: false,
			hasStarted: false,
			errorMessage: ""
		}

		ipcRenderer.on('started', (event) => {
			this.setState({
				isStarting: false,
				hasStarted: true
			})
		});

		ipcRenderer.on('stopped', (event) => {
			this.setState({
				isStarting: false,
				hasStarted: false
			})
		})

		ipcRenderer.on('errorPlay', (event, err) => {

			this.setState({
				isStarting: false,
				hasStarted: false,
				errorMessage: err
			})
		});

	}

	handleDismiss = () => {
		this.setState({
			errorMessage: ""
		})

	}

	start() {
		ipcRenderer.send('cmd', 'start')
	}

	stop() {
		ipcRenderer.send('cmd', 'stop')
	}

	render() {
		
		const button = 
			!this.state.isStarting ? <Button content='Start' icon='play' labelPosition='right' onClick={this.start.bind(this)} /> :
			this.state.isStarting ? <Button content='Starting...' icon='play' labelPosition='right' disabled /> :
			<Button content='Stop' icon='stop' labelPosition='right' onClick={this.stop.bind(this)} />;

		let message = ""

		if(this.state.errorMessage) {
			message = <Message
				onDismiss={this.handleDismiss.bind(this)}
				header='cloudRIG could not start'
				content={this.state.errorMessage}
			/>
		}

		return(
			
			<div>
				{message}
				{button}
			</div>
		)

	}

}

export default Play;