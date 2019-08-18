import React, { Component } from "react";
import { Icon, Segment, Step, Grid, Header, Modal, Message } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import "./App.css";
import Configuration from "./Configuration";
import Initialization from "./Initialization";
import Play from "./Play";

const { ipcRenderer } = window.require("electron");

const pages = { Configuration: 1, Initialization: 2, Play: 3, Loading: 4 };

class App extends Component {
	state = {
		isPossessive: false,
		currentPage: pages.Loading,
		config: {},
		setupValid: false,
		disableNonStartPages: false,
		logOutput: ["Welcome :)"]
	};

	changePage(e) {
		this.setState({
			currentPage: e
		});
	}

	handleChoose(e) {
		ipcRenderer.send("cmd", "selectCredentialsFile");
	}

	componentWillUnmount() {
		ipcRenderer.removeAllListeners("getConfigurationValidity");
		ipcRenderer.removeAllListeners("setupValid");
		ipcRenderer.removeAllListeners("disableNonPlay");
		ipcRenderer.removeAllListeners("changePage");
		ipcRenderer.removeAllListeners("log");
		ipcRenderer.removeAllListeners("error");
		ipcRenderer.removeAllListeners("possessiveStarted");
		ipcRenderer.removeAllListeners("possessiveFinished");
		ipcRenderer.removeAllListeners("credentialsFileChosen");
		ipcRenderer.removeAllListeners("savedInitialConfiguration");
	}

	componentDidMount() {
		ipcRenderer.on("getConfigurationValidity", (event, valid) => {
			if (valid) {
				ipcRenderer.sendSync("cmd", "setConfiguration");
				this.setState({
					currentPage: pages.Initialization
				});
				event.sender.send("cmd", "log", "Configured");
				return;
			}
			this.setState({
				currentPage: pages.Configuration
			});
		});

		ipcRenderer.on("started", event => {
			if (!document.hasFocus()) {
				new Notification("cloudRIG", {
					body: "cloudRIG is ready",
					silent: true
				});
			}
		});

		ipcRenderer.on("setupValid", (event, valid) => {
			this.setState({
				setupValid: valid,
				currentPage: pages.Play
			});
			event.sender.send("cmd", "log", "Initialized");
		});

		ipcRenderer.on("disableNonPlay", (event, isRunning) => {
			this.setState({
				disableNonStartPages: isRunning
			});
		});

		ipcRenderer.on("changePage", (event, newPage) => {
			this.setState({
				currentPage: newPage
			});
		});

		ipcRenderer.on("log", (event, arg) => {
			this.setState({
				logOutput: [...this.state.logOutput, typeof arg === "string" ? arg : JSON.stringify(arg, null, 4)]
			});
			setTimeout(() => {
				var objDiv = document.getElementById("output");
				if (objDiv) {
					objDiv.scrollTop = objDiv.scrollHeight;
				}
			});
		});

		ipcRenderer.on("error", (event, arg) => {
			ipcRenderer.send("cmd", "error", "Sorry, there was an error, see log below.");
			this.setState({
				isPossessive: false
			});
			event.sender.send("cmd", "log", arg);
		});

		ipcRenderer.on("possessiveStarted", (event, arg) => {
			this.setState({
				isPossessive: true
			});
		});

		ipcRenderer.on("possessiveFinished", (event, arg) => {
			this.setState({
				isPossessive: false
			});
		});

		ipcRenderer.on("credentialsFileChosen", (event, filePaths) => {
			if (filePaths) {
				var newConfig = { ...this.state.config, AWSCredentialsFile: filePaths[0] };
				ipcRenderer.send("cmd", "saveInitialConfiguration", newConfig);
			} else {
				ipcRenderer.send(
					"cmd",
					"error",
					"You have to select an AWS credentials file or have a test account to use cloudRIG"
				);
			}
		});

		ipcRenderer.on("savedInitialConfiguration", (event, config) => {
			this.setState({
				config: config
			});
			ipcRenderer.send("cmd", "getConfigurationValidity");
		});

		const config = ipcRenderer.sendSync("cmd", "getConfiguration");

		if (config.AWSCredentialsFile) {
			ipcRenderer.sendSync("cmd", "setConfiguration");
		}
		this.setState(
			{
				config
			},
			() => {
				ipcRenderer.send("cmd", "getConfigurationValidity");
			}
		);
	}

	render() {
		const currentPage =
			this.state.currentPage === pages.Configuration ? (
				<Configuration />
			) : this.state.currentPage === pages.Initialization ? (
				<Initialization />
			) : this.state.currentPage === pages.Play ? (
				<Play />
			) : null;

		const DeprecationMessage = () => <Message.Content>
		This version is deprecated. Please uninstall and re-download at{' '}
		<a href="https://github.com/cloudRIG/cloudrig/" rel="noopener noreferrer" target="_blank">https://github.com/cloudRIG/cloudrig/</a>
	</Message.Content> 

		if (!this.state.config.AWSCredentialsFile) {
			return (
				<div>
					<Modal open={true}>
						<Modal.Header>
							Welcome to cloudRIG <Icon name="smile" />
						</Modal.Header>
						<Modal.Content>
							<Modal.Description>
							<Message
								icon
								warning
								size="tiny"
								style={{
									borderRadius: 0,
									margin: "0",
									width: "100%"
								}}>
								<Icon name="exclamation circle" />
								<DeprecationMessage />
							</Message>
								<Header>NOTICE</Header>
								<p>
									<small>
										THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
										NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
										NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
										OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
										CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
									</small>
								</p>
							</Modal.Description>
						</Modal.Content>
					</Modal>
					
				</div>
			);
		} else {
			return (
				<div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
					<Message
						icon
						warning
						size="tiny"
						style={{
							borderRadius: 0,
							position: "absolute",
							bottom: "120px",
							zIndex: 999999999,
							margin: "0",
							padding: 5,
							width: "100%"
						}}>
						<Icon name="exclamation circle" />
						<DeprecationMessage />
					</Message>
					
					<Grid style={{ flexGrow: 1 }} className={this.state.isPossessive ? "possessive" : ""}>
						<Grid.Row>
							<Grid.Column>
								<Step.Group attached="top">
									<Step
										link
										active={this.state.currentPage === pages.Configuration}
										onClick={this.changePage.bind(this, pages.Configuration)}
										disabled={this.state.disableNonStartPages}>
										<Icon name="configure" />
										<Step.Content>
											<Step.Title>Configure</Step.Title>
										</Step.Content>
									</Step>
									<Step
										link
										active={this.state.currentPage === pages.Initialization}
										onClick={this.changePage.bind(this, pages.Initialization)}
										disabled={this.state.currentPage === pages.Configuration || this.state.disableNonStartPages}>
										<Icon name="tasks" />
										<Step.Content>
											<Step.Title>Initialize</Step.Title>
										</Step.Content>
									</Step>
									<Step
										link
										active={this.state.currentPage === pages.Play}
										disabled={
											this.state.currentPage === pages.Configuration || this.state.currentPage === pages.Initialization
										}>
										<Icon name="game" />
										<Step.Content>
											<Step.Title>Play</Step.Title>
										</Step.Content>
									</Step>
								</Step.Group>
								<Segment attached className="stretched-segment" basic>
									{currentPage}
								</Segment>
							</Grid.Column>
						</Grid.Row>
					</Grid>

					<div style={{ height: "120px", position: "relative", padding: "1rem" }}>
						<pre id="output">{this.state.logOutput.join("\n")}</pre>
					</div>
				</div>
			);
		}
	}
}

export default App;
