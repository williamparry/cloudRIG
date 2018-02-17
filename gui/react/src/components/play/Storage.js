import React, { Component } from 'react';
import { Button, Form, Message, Table, Header, Icon } from 'semantic-ui-react'
import 'semantic-ui-css/semantic.min.css';

class Storage extends Component {

	constructor(props) {
		super(props)

		this.state = { ...props, newVolume: 100 }

	}

	componentWillReceiveProps(newProps) {
		this.setState({
			...this.state,
			...newProps
		})
	}

	handleChange(e, data) {
		this.setState({
			newVolume: data.value
		})
	}

	submit() {

		this.state.handleSubmit(this.state.newVolume)
	}

	delete() {
		this.state.handleDelete(this.state.volumesInAZ[0])
	}

	transfer() {
		this.state.handleTransfer(this.state.volumesNotInAZ[0])
	}

	render() {

		const message = this.state.volumesNotInAZ.length > 0 ?
			<div>
				<Message warning icon='exclamation triangle' header='You have a volume in another Availability Zone' content='You will still be charged for it if you make another one here.' />
				<br />
			</div>
			: ''
		const buttons = this.state.volumesInAZ.length > 0 ?
			(
				<div>
					<Button content='Delete volume' icon='delete' labelPosition='right' onClick={this.delete.bind(this)} />
					<Button content='Expand volume' icon='expand' labelPosition='right' disabled />
				</div>)
			:
			(

				<Form>
					<Form.Group inline>
						<Form.Select label='Volume Size' value={this.state.newVolume} onChange={this.handleChange.bind(this)} options={[
							{ key: '100', text: '100 GB', value: 100 },
							{ key: '150', text: '150 GB', value: 150 },
							{ key: '200', text: '200 GB', value: 200 },
						]} />
						<Button onClick={this.submit.bind(this)}>Create</Button>
						{this.state.volumesNotInAZ.length > 0 ? <Button content='Transfer here' icon='exchange' labelPosition='right' onClick={this.transfer.bind(this)} /> : ''}
					</Form.Group>
				</Form>
			);


		return (

			<div>
				{message}
				{buttons}

				<Header>Prices</Header>
				<Table definition>
					<Table.Body>
						<Table.Row>
							<Table.Cell><small>Default cloudRIG Drive 30GB</small></Table.Cell>
							<Table.Cell><small>approx.</small> $1.60/month</Table.Cell>
						</Table.Row>
						<Table.Row>
							<Table.Cell><small>Extra Volume (persistent volume)<sup>*</sup></small></Table.Cell>
							<Table.Cell>
								<small>approx.</small> $11.90/month for 100GB
						</Table.Cell>
						</Table.Row>

					</Table.Body>
				</Table>

				<small>
					<sup>*</sup>You are only charged for how much you use, and it is tied to one Availability Zone.<br />
					<a href='https://aws.amazon.com/ebs/pricing/' target='_blank' rel='noopener noreferrer'>Detailed pricing <Icon name='external' /></a>

				</small>
			</div>
		)

	}

}

export default Storage;