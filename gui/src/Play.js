import React, { Component } from 'react';
import { Button, Message } from 'semantic-ui-react'

const { ipcRenderer } = window.require('electron');

class Play extends Component {

	constructor() {

		super();

		this.state = {
			isLoading: true,
			isStarting: false,
			hasStarted: false,
			errorMessage: "",
			cloudRIGState: {
				activeInstances: [],
				pendingInstances: [],
				shuttingDownInstances: [],
				stoppedInstances: []
			}
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

		ipcRenderer.on('gotState', (event, state) => {
			
			this.setState({
				isLoading: false,
				cloudRIGState: state
			})

			ipcRenderer.send('cmd', 'log', 'Ready')

		});

		ipcRenderer.on('startRunning', (event, isRunning) => {
			
			this.setState({
				isStarting: true,
				hasStarted: false
			})

		})

	}

	componentWillUnmount() {

		ipcRenderer.removeAllListeners('startRunning')
		ipcRenderer.removeAllListeners('gotState')
		ipcRenderer.removeAllListeners('stopped')
		ipcRenderer.removeAllListeners('started')


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

	componentDidMount() {

		this.setState({
			isLoading: true
		});

		ipcRenderer.send('cmd', 'getState')

	}
	

	render() {
		
		let actionButtons;

		if(this.state.cloudRIGState.activeInstances.length > 0) {
			
			actionButtons = 
			<div>
				<Button content='Stop' icon='stop' labelPosition='right' onClick={this.stop.bind(this)} />
				<Button content='Schedule stop' icon='stop' labelPosition='right' onClick={this.stop.bind(this)} disabled />
			</div>
			

		} else {
			
			if(!this.state.isStarting) {
				actionButtons = <Button content='Start' icon='play' labelPosition='right' onClick={this.start.bind(this)} />
			} else {
				actionButtons = <Button content='Starting...' icon='play' labelPosition='right' disabled />
			}

		}

		let message = ""

		if(this.state.errorMessage) {
			message = <Message
				onDismiss={this.handleDismiss.bind(this)}
				header='cloudRIG could not start'
				content={this.state.errorMessage}
			/>
		}

		if(this.state.isLoading) {

			return(

				<div>
					
				</div>
			)

		} else {

			return(

				<div>
					{message}
					{actionButtons}
				</div>
			)
		}

		

	}

}

export default Play;