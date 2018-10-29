import React, { Component } from "react";
import Loading from "./Loading";
import { Icon, List, Button, Header } from "semantic-ui-react";

const { ipcRenderer } = window.require("electron");

class Initialization extends Component {
	constructor() {
		super();

		this.state = {
			isLoading: true,
			setupSteps: []
		};

		ipcRenderer.on("setups", (event, setups) => {
			this.setState({
				isLoading: false,
				setupSteps: setups
			});
		});

		ipcRenderer.on("setupCheck", (event, setups) => {
			ipcRenderer.send("cmd", "setup");
		});
	}

	componentDidMount() {
		ipcRenderer.send("cmd", "setup");

		this.setState({
			isLoading: true
		});
	}

	saveSetup() {
		this.setState({
			isLoading: true
		});

		ipcRenderer.send("cmd", "runSetupSteps");
	}

	componentWillUnmount() {
		ipcRenderer.removeAllListeners("setups");
		ipcRenderer.removeAllListeners("setupCheck");
	}

	render() {
		if (this.state.isLoading) {
			return <Loading message="Processing" />;
		} else if (this.state.setupSteps.length > 0) {
			const setupSteps = this.state.setupSteps.map((step, i) => {
				return (
					<List.Item key={"step-" + i}>
						<List.Icon name="question circle" />
						<List.Content>{step.q}</List.Content>
					</List.Item>
				);
			});

			return (
				<div>
					<Header as="h2">
						Some setup required
						<Header.Subheader>
							But, I can do it for you <Icon name="smile" />
						</Header.Subheader>
					</Header>

					<List>{setupSteps}</List>

					<br />

					<Button onClick={this.saveSetup.bind(this)} content="Yes" icon="arrow right" labelPosition="right" />
				</div>
			);
		} else {
			return <div />;
		}
	}
}

export default Initialization;
