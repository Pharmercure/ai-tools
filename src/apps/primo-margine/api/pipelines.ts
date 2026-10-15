// Le cinque letture da MongoDB (via DB Proxy). Ogni pipeline raggruppa in pochi documenti:
// il proxy taglia a 1000 documenti in silenzio, quindi non vanno mai restituite righe singole.
// Nei risultati i campi hanno nomi brevi (p, a, m...) perché i dati sono grandi: vedi compute.ts.

export type Pipeline = { collection: string; pipeline: object[] };

export const accounts: Pipeline = {
	"collection": "PharmaciesGroup",
	"pipeline": [
		{
			"$project": {
				"_id": 0,
				"id": {
					"$toString": "$_id"
				},
				"nome": "$Name",
				"pacchetto": "$TotalCoins",
				"fatt": "$SubscriptionBillingType",
				"canone": {
					"$convert": {
						"input": "$SubscriptionPrice",
						"to": "double",
						"onError": null,
						"onNull": null
					}
				}
			}
		},
		{
			"$group": {
				"_id": "gruppi",
				"righe": {
					"$push": "$$ROOT"
				}
			}
		},
		{
			"$unionWith": {
				"coll": "DeliveryAgency",
				"pipeline": [
					{
						"$project": {
							"_id": 0,
							"id": {
								"$toString": "$_id"
							},
							"nome": "$Name",
							"interno": "$IsInternal",
							"stato": "$Status",
							"p": "$DeliveryPrice",
							"pz": "$DeliveryPriceExtendedZone",
							"prx": "$PrescriptionPickupCost",
							"pbk": "$LargePackagePrice",
							"citta": {
								"$first": "$CityCoverage.Name"
							}
						}
					},
					{
						"$group": {
							"_id": "fornitori",
							"righe": {
								"$push": "$$ROOT"
							}
						}
					}
				]
			}
		},
		{
			"$unionWith": {
				"coll": "Pharmacy",
				"pipeline": [
					{
						"$project": {
							"_id": 0,
							"id": {
								"$toString": "$_id"
							},
							"nome": "$Name",
							"rs": "$BusinessName",
							"piva": "$VATNumber",
							"citta": "$Address.City",
							"prov": "$Address.Province",
							"aff": "$Affiliate",
							"gruppo": {
								"$toString": "$PharmaciesGroupId"
							},
							"zona": "$ZoneBaseId"
						}
					},
					{
						"$group": {
							"_id": "farmacie",
							"righe": {
								"$push": "$$ROOT"
							}
						}
					}
				]
			}
		},
		{
			"$unionWith": {
				"coll": "Invoice",
				"pipeline": [
					{
						"$match": {
							"InsertDate": {
								"$gte": {
									"$date": "2026-01-15T00:00:00Z"
								}
							}
						}
					},
					{
						"$project": {
							"_id": 0,
							"x": "$ExternalId",
							"p": "$Partner.PharmacyId",
							"g": "$Partner.GroupId",
							"gb": "$IsBillingGroup",
							"t": "$Type",
							"f": "$From",
							"to": "$To",
							"net": "$TotalToBePaidNet"
						}
					},
					{
						"$group": {
							"_id": "fatture",
							"righe": {
								"$push": "$$ROOT"
							}
						}
					}
				]
			}
		},
		{
			"$unionWith": {
				"coll": "ContractHistory",
				"pipeline": [
					{
						"$match": {
							"ExpirationDate": {
								"$gte": {
									"$date": "2026-02-01T00:00:00Z"
								}
							}
						}
					},
					{
						"$project": {
							"_id": 0,
							"p": "$PartnerId",
							"a": "$ActivationDate",
							"e": "$ExpirationDate",
							"nome": "$SubscriptionName",
							"coin": "$DefaultCoins",
							"b": {
								"$map": {
									"input": {
										"$filter": {
											"input": {
												"$ifNull": [
													"$Blocks",
													[]
												]
											},
											"as": "x",
											"cond": {
												"$gte": [
													"$$x.EndDate",
													{
														"$date": "2026-02-01T00:00:00Z"
													}
												]
											}
										}
									},
									"as": "x",
									"in": {
										"s": "$$x.StartDate",
										"e": "$$x.EndDate",
										"pr": {
											"$convert": {
												"input": "$$x.Price",
												"to": "double",
												"onError": 0,
												"onNull": 0
											}
										},
										"tc": "$$x.TotalCoins",
										"uc": "$$x.UsedCoins",
										"ex": {
											"$sum": {
												"$map": {
													"input": {
														"$ifNull": [
															"$$x.Extra",
															[]
														]
													},
													"as": "e",
													"in": {
														"$multiply": [
															{
																"$convert": {
																	"input": "$$e.CoinPrice",
																	"to": "double",
																	"onError": 0,
																	"onNull": 0
																}
															},
															{
																"$ifNull": [
																	"$$e.UsedCoins",
																	0
																]
															}
														]
													}
												}
											}
										},
										"exc": {
											"$sum": {
												"$map": {
													"input": {
														"$ifNull": [
															"$$x.Extra",
															[]
														]
													},
													"as": "e",
													"in": {
														"$ifNull": [
															"$$e.UsedCoins",
															0
														]
													}
												}
											}
										}
									}
								}
							}
						}
					},
					{
						"$group": {
							"_id": "contratti",
							"righe": {
								"$push": "$$ROOT"
							}
						}
					}
				]
			}
		}
	]
};

// __A__ = mezzanotte italiana di oggi in UTC (ISO 8601); vedi ordersPipeline().
const ordersTemplate: Pipeline = {
	"collection": "Order",
	"pipeline": [
		{
			"$match": {
				"CurrentStateCode": "9",
				"Delivery.DeliveryDateTime": {
					"$gte": {
						"$date": "2026-02-28T23:00:00Z"
					},
					"$lt": {
						"$date": "__A__"
					}
				}
			}
		},
		{
			"$project": {
				"_id": 0,
				"m": {
					"$dateToString": {
						"date": "$Delivery.DeliveryDateTime",
						"format": "%Y-%m",
						"timezone": "Europe/Rome"
					}
				},
				"p": "$PharmacyId",
				"a": "$Delivery.DeliveryAgencyId",
				"acc": {
					"$gt": [
						{
							"$convert": {
								"input": "$Payment.ActualCoinCost",
								"to": "double",
								"onError": 0,
								"onNull": 0
							}
						},
						0
					]
				},
				"dac": {
					"$convert": {
						"input": "$Payment.DeliveryAgencyCost",
						"to": "double",
						"onError": 0,
						"onNull": 0
					}
				},
				"lz": {
					"$cond": [
						"$Delivery.DeliveryInLargeZone",
						1,
						0
					]
				},
				"rx": {
					"$cond": [
						"$Delivery.HasPrescriptionPickup",
						1,
						0
					]
				},
				"bk": {
					"$cond": [
						"$Delivery.BulkyDelivery",
						1,
						0
					]
				},
				"o": "$Origin",
				"co": {
					"$ifNull": [
						"$Delivery.DetractedDeliveries",
						0
					]
				}
			}
		},
		{
			"$set": {
				"senza": {
					"$and": [
						{
							"$not": [
								"$acc"
							]
						},
						{
							"$lte": [
								"$dac",
								0
							]
						}
					]
				}
			}
		},
		{
			"$group": {
				"_id": {
					"m": "$m",
					"p": "$p",
					"a": "$a"
				},
				"n": {
					"$sum": 1
				},
				"nAcc": {
					"$sum": {
						"$cond": [
							"$acc",
							1,
							0
						]
					}
				},
				"dac": {
					"$sum": {
						"$cond": [
							"$acc",
							0,
							"$dac"
						]
					}
				},
				"nDac": {
					"$sum": {
						"$cond": [
							{
								"$and": [
									{
										"$not": [
											"$acc"
										]
									},
									{
										"$gt": [
											"$dac",
											0
										]
									}
								]
							},
							1,
							0
						]
					}
				},
				"nS": {
					"$sum": {
						"$cond": [
							"$senza",
							1,
							0
						]
					}
				},
				"lzS": {
					"$sum": {
						"$cond": [
							"$senza",
							"$lz",
							0
						]
					}
				},
				"rxS": {
					"$sum": {
						"$cond": [
							"$senza",
							"$rx",
							0
						]
					}
				},
				"bkS": {
					"$sum": {
						"$cond": [
							"$senza",
							"$bk",
							0
						]
					}
				},
				"rx": {
					"$sum": "$rx"
				},
				"lz": {
					"$sum": "$lz"
				},
				"wa": {
					"$sum": {
						"$cond": [
							{
								"$eq": [
									"$o",
									2
								]
							},
							1,
							0
						]
					}
				},
				"co": {
					"$sum": "$co"
				}
			}
		},
		{
			"$group": {
				"_id": "$_id.m",
				"righe": {
					"$push": {
						"r": [
							"$_id.p",
							"$_id.a",
							"$n",
							"$nAcc",
							{
								"$round": [
									"$dac",
									2
								]
							},
							"$nDac",
							"$nS",
							"$lzS",
							"$rxS",
							"$bkS",
							"$rx",
							"$lz",
							"$wa",
							"$co"
						]
					}
				}
			}
		},
		{
			"$sort": {
				"_id": 1
			}
		}
	]
};

export const deliveryCosts: Pipeline = {
	"collection": "DeliveryAgencyInvoice",
	"pipeline": [
		{
			"$match": {
				"To": {
					"$gte": {
						"$date": "2026-03-01T00:00:00Z"
					}
				}
			}
		},
		{
			"$project": {
				"_id": 0,
				"a": {
					"$toString": "$DeliveryAgencyId"
				},
				"nome": "$DeliveryAgencyName",
				"from": "$From",
				"to": "$To",
				"act": "$ActualTotalCost",
				"est": "$EstimatedTotalCost",
				"coin": "$TotalCoins",
				"cons": "$TotalDeliveries",
				"link": "$InvoiceLink",
				"ins": "$InsertDate"
			}
		},
		{
			"$group": {
				"_id": null,
				"righe": {
					"$push": "$$ROOT"
				}
			}
		}
	]
};

export const invoicesNotOnFic: Pipeline = {
	"collection": "Invoice",
	"pipeline": [
		{
			"$match": {
				"InsertDate": {
					"$gte": {
						"$date": "2026-03-01T00:00:00Z"
					}
				},
				"Type": {
					"$in": [
						1,
						2,
						3,
						5
					]
				},
				"$or": [
					{
						"ExternalId": null
					},
					{
						"ExternalId": 0
					}
				]
			}
		},
		{
			"$project": {
				"_id": 0,
				"x": "$ExternalId",
				"p": "$Partner.PharmacyId",
				"g": "$Partner.GroupId",
				"gb": "$IsBillingGroup",
				"t": "$Type",
				"f": "$From",
				"to": "$To",
				"net": "$TotalToBePaidNet",
				"ins": "$InsertDate",
				"prod": "$FICInvoice.FICProducts",
				"st": "$State"
			}
		},
		{
			"$group": {
				"_id": "fattureNonSuFIC",
				"n": {
					"$sum": 1
				},
				"righe": {
					"$push": "$$ROOT"
				}
			}
		}
	]
};

export const invoicesBeforeMarch: Pipeline = {
	"collection": "Invoice",
	"pipeline": [
		{
			"$match": {
				"InsertDate": {
					"$lt": {
						"$date": "2026-03-01T00:00:00Z"
					}
				},
				"To": {
					"$gte": {
						"$date": "2026-03-01T00:00:00Z"
					}
				}
			}
		},
		{
			"$project": {
				"_id": 0,
				"x": "$ExternalId",
				"p": "$Partner.PharmacyId",
				"g": "$Partner.GroupId",
				"gb": "$IsBillingGroup",
				"t": "$Type",
				"f": "$From",
				"to": "$To",
				"net": "$TotalToBePaidNet",
				"ins": "$InsertDate",
				"prod": "$FICInvoice.FICProducts"
			}
		},
		{
			"$group": {
				"_id": "fatturePrimaDiMarzo",
				"n": {
					"$sum": 1
				},
				"righe": {
					"$push": "$$ROOT"
				}
			}
		}
	]
};

export function ordersPipeline(untilUtc: string): Pipeline {
	return JSON.parse(JSON.stringify(ordersTemplate).replace("__A__", untilUtc));
}
