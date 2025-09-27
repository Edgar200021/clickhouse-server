import type { FastifyInstance } from "fastify/types/instance.js";

import { AsyncTask, SimpleIntervalJob } from "toad-scheduler";

export async function createCronService({
	priceService,
	userService,
	scheduler,
	log,
}: FastifyInstance) {
	const getExchangeRatesTask = new AsyncTask(
		"Get exchange rates task",
		() => {
			return priceService.getExchangeRates();
		},
		(err: Error) => {
			log.error(`Get exchange rates task: ${err}`);
		},
	);

	const deleteNotVerifiedUsersTask = new AsyncTask(
		"Delete not verified users task",
		() => {
			return userService.deleteNotVerifiedUsers();
		},
		(err: Error) => {
			log.error(`Delete not verified users task: ${err}`);
		},
	);

	scheduler.addSimpleIntervalJob(
		new SimpleIntervalJob(
			{ days: 1, runImmediately: true },
			getExchangeRatesTask,
		),
	);

	scheduler.addSimpleIntervalJob(
		new SimpleIntervalJob(
			{ hours: 1, runImmediately: true },
			deleteNotVerifiedUsersTask,
		),
	);
}
