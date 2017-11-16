import React, { Component } from 'react';
import { Icon, Label, Menu, Table, Grid, Container, Modal, Header, Button, Form } from 'semantic-ui-react'
import 'semantic-ui-css/semantic.min.css';

const { ipcRenderer } = window.require('electron');

const options = [
	{ key: 'm', text: 'Male', value: 'male' },
	{ key: 'f', text: 'Female', value: 'female' },
]

class App extends Component {

	state = {}

	handleChange = (e, { value }) => this.setState({ value })
	
	constructor() {
		super()
		ipcRenderer.on('log', (event, arg) => {
			console.log(arg)
		})
	}

	componentDidMount() {
		const setupSteps = ipcRenderer.send('setup');
		console.log(setupSteps)
	}

	render() {
		const { value } = this.state
		return (
			<Container>
				<Grid>
					<Grid.Column width={10}>
						cloudRIG
          			</Grid.Column>
					<Grid.Column width={6}>
						
						<Modal trigger={<Button>Edit configuration</Button>}>
							<Modal.Header>Configuration</Modal.Header>
							<Modal.Content>
								<Modal.Description>
									<Form>
										<Form.Group widths='equal'>
											<Form.Input label='First name' placeholder='First name' />
											<Form.Input label='Last name' placeholder='Last name' />
											<Form.Select label='Gender' options={options} placeholder='Gender' />
										</Form.Group>
										<Form.Group inline>
											<label>Size</label>
											<Form.Radio label='Small' value='sm' checked={value === 'sm'} onChange={this.handleChange} />
											<Form.Radio label='Medium' value='md' checked={value === 'md'} onChange={this.handleChange} />
											<Form.Radio label='Large' value='lg' checked={value === 'lg'} onChange={this.handleChange} />
										</Form.Group>
										<Form.TextArea label='About' placeholder='Tell us more about you...' />
										<Form.Checkbox label='I agree to the Terms and Conditions' />
										<Form.Button>Submit</Form.Button>
									</Form>
								</Modal.Description>
							</Modal.Content>
						</Modal>


					</Grid.Column>
				</Grid>
			</Container>
		);
	}
}

export default App;
