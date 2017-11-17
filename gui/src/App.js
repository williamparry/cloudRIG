import React, { Component } from 'react';
import { Icon, Image, Segment, Step, Divider, TextArea, Form, Grid, Select, Button, Modal, Message } from 'semantic-ui-react'
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
	}

	constructor() {

		super()

	}

	componentDidMount() {
		
		ipcRenderer.send('cmd', 'getConfigurationValidity');

		ipcRenderer.on('getConfigurationValidity', (event, valid) => {

			if(valid) {
				ipcRenderer.sendSync('cmd', 'setConfiguration');
				this.setState({
					currentPage: pages.Initialization
				});
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

		})
		

		ipcRenderer.on('log', (event, arg) => {
			console.log(arg)
		})

	}

	changePage(e) {
		
		this.setState({
			currentPage: e
		})
	}

	render() {
		
		const currentPage = 
			this.state.currentPage == pages.Configuration ? <Configuration /> : 
			this.state.currentPage == pages.Initialization ? <Initialization /> :
			this.state.currentPage == pages.Play ? <Play /> : null

		return (
			
			<Grid>
				<Grid.Row>
					<Grid.Column>
						<Step.Group attached='top'>
							<Step link 
								active={this.state.currentPage == pages.Configuration} 
								onClick={this.changePage.bind(this, pages.Configuration)}>
								<Icon name='configure' />
								<Step.Content>
									<Step.Title>Configure</Step.Title>
								</Step.Content>
							</Step>
							<Step link 
								active={this.state.currentPage == pages.Initialization} 
								onClick={this.changePage.bind(this, pages.Initialization)}
								disabled={this.state.currentPage == pages.Configuration}>
								<Icon name='tasks' />
								<Step.Content>
									<Step.Title>Initialize</Step.Title>
								</Step.Content>
							</Step>
							<Step link 
								active={this.state.currentPage == pages.Play}
								disabled={this.state.currentPage == pages.Configuration || this.state.currentPage == pages.Initialization}>
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
			</Grid>

		);
	}
}

export default App;
