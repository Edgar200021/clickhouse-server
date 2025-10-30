import type {FastifyInstance} from "fastify/types/instance.js";

import {AsyncTask, SimpleIntervalJob} from "toad-scheduler";
import fp from "fastify-plugin";


export default fp(async (fastify: FastifyInstance) => {
	const {userService, log, scheduler, orderService} = fastify

	const deleteNotVerifiedUsersTask = new AsyncTask(
		"Delete not verified users task",
		() => userService.deleteNotVerifiedUsers(),
		(err: Error) => {
			log.error(`Delete not verified users task: ${err}`);
		},
	);

	const cancelExpiredOrders = new AsyncTask(
		"Cancel expired orders tasks",
		() => orderService.cancelExpiredOrders(),
		(err: Error) => {
			log.error(`Cancel expired orders task: ${err}`);
		},
	);

	scheduler.addSimpleIntervalJob(
		new SimpleIntervalJob(
			{hours: 1, runImmediately: true},
			deleteNotVerifiedUsersTask,
		),
	);

	scheduler.addSimpleIntervalJob(
		new SimpleIntervalJob(
			{minutes: 1, runImmediately: true},
			cancelExpiredOrders,
		),
	);


}, {
	name: "cronService",
	dependencies: ["orderService", "userService"]
})