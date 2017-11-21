import React, { Component } from 'react';
import { Icon, Segment, Container, Step, Grid } from 'semantic-ui-react'
import 'semantic-ui-css/semantic.min.css';
import './App.css';
import Configuration from './Configuration';
import Initialization from './Initialization';
import Play from './Play';


const { ipcRenderer } = window.require('electron');

const pages = { "Configuration": 1, "Initialization": 2, "Play": 3, "Loading": 4 }

class App extends Component {

	state = {
		currentPage: pages.Loading,
		disableNonStartPages: false,
		logOutput: ["Welcome :)"]
	}

	componentDidMount() {
		
		ipcRenderer.send('cmd', 'getConfigurationValidity');

		ipcRenderer.on('getConfigurationValidity', (event, valid) => {

			if(valid) {
				ipcRenderer.sendSync('cmd', 'setConfiguration');
				this.setState({
					currentPage: pages.Initialization
				});

				event.sender.send('cmd', 'log', '✓ Configured')

				return;		
			}

			this.setState({
				currentPage: pages.Configuration
			})
		})

		ipcRenderer.on('setupValid', (event, valid) => {
			
			this.setState({
				currentPage: pages.Play
			})

			event.sender.send('cmd', 'log', '✓ Initialized')

		})

		ipcRenderer.on('disableNonPlay', (event, isRunning) => {
			
			this.setState({
				disableNonStartPages: isRunning
			})

		})

		ipcRenderer.on('changePage', (event, newPage) => {
			
			this.setState({
				currentPage: newPage
			})

		})
		
		ipcRenderer.on('log', (event, arg) => {
			
			this.setState({
				logOutput: [...this.state.logOutput, typeof arg === "string" ? arg : JSON.stringify(arg, null, 4)]
			})

			setTimeout(() => {

				var objDiv = document.getElementById("output");
				objDiv.scrollTop = objDiv.scrollHeight;

			})
		})

		ipcRenderer.on('error', (event, arg) => {
			ipcRenderer.send('cmd', 'error', 'Sorry, there was an error, see log below.');

			event.sender.send('cmd', 'log', arg)

		})

	}

	changePage(e) {
		
		this.setState({
			currentPage: e
		})

	}

	render() {
		
		const currentPage = 
			this.state.currentPage === pages.Configuration ? <Configuration /> : 
			this.state.currentPage === pages.Initialization ? <Initialization /> :
			this.state.currentPage === pages.Play ? <Play /> : null

		return (
			
			<Grid stretched>
				<Grid.Row style={{height: 476}}>
					<Grid.Column>
						<Step.Group attached='top'>
							<Step link 
								active={this.state.currentPage === pages.Configuration} 
								onClick={this.changePage.bind(this, pages.Configuration)}
								disabled={this.state.disableNonStartPages}>
								<Icon name='configure' />
								<Step.Content>
									<Step.Title>Configure</Step.Title>
								</Step.Content>
							</Step>
							<Step link 
								active={this.state.currentPage === pages.Initialization} 
								onClick={this.changePage.bind(this, pages.Initialization)}
								disabled={this.state.currentPage === pages.Configuration || this.state.disableNonStartPages}>
								<Icon name='tasks' />
								<Step.Content>
									<Step.Title>Initialize</Step.Title>
								</Step.Content>
							</Step>
							<Step link 
								active={this.state.currentPage === pages.Play}
								disabled={this.state.currentPage === pages.Configuration || this.state.currentPage === pages.Initialization}>
								<Icon name='game' />
								<Step.Content>
								<Step.Title>Play</Step.Title>
								</Step.Content>
							</Step>
						</Step.Group>

						
						<Segment attached className="stretched-segment">
							{currentPage}
						</Segment>

					</Grid.Column>
					
				</Grid.Row>
				<Grid.Row verticalAlign="bottom">
					<Grid.Column>
						<Container>
<pre id='output' style={{ height: 60, overflowY: 'scroll' }}>
{this.state.logOutput.join("\n")}
</pre>

						
						</Container>
					</Grid.Column>
					
				</Grid.Row>
			</Grid>

		);
	}
}

export default App;
