import React, { Component } from 'react';
import { Form, Button } from 'semantic-ui-react'
import 'semantic-ui-css/semantic.min.css';


class AWSProfile extends Component {

	constructor(props) {
		super(props)

		this.state ={...props}

		if(!this.state.currentCredentials) {
			this.state.currentCredentials = {
				profile: "",
				aws_access_key_id: "",
				aws_secret_access_key: ""
			}
		}
		
	}

	// TODO move to use the one in App.js

	handleChange(e, data) {
		// If you are using babel, you can use ES 6 dictionary syntax { [e.target.name] = e.target.value }
		var change = {
			currentCredentials: {...this.state.currentCredentials}
		}
		change['currentCredentials'][data.name] = data.value
		this.setState(change)
	}

	submit() {
		if(this.state.disallowedProfileNames.includes(this.state.currentCredentials.profile)) {
			console.log('disallowed')
			return;
		}
		this.state.handleSubmit(this.state.currentCredentials)
	}

	render() {
		
		return(
			<Form>

				<Form.Input label='Profile Name' 
					placeholder='e.g. default' 
					name="profile" 
					value={this.state.currentCredentials.profile} 
					onChange={this.handleChange.bind(this)}
					required />

				<Form.Input label='Access Key Id' 
					placeholder='aws_access_key_id' 
					name="aws_access_key_id" 
					value={this.state.currentCredentials.aws_access_key_id}
					onChange={this.handleChange.bind(this)}
					required />

				<Form.Input label='Secret Access Key' 
					placeholder='aws_secret_access_key' 
					name="aws_secret_access_key" 
					value={this.state.currentCredentials.aws_secret_access_key} 
					onChange={this.handleChange.bind(this)}
					required />

				<Button onClick={this.submit.bind(this)}>
					Submit
				</Button>

			</Form>
		  )

	}

}

export default AWSProfile;