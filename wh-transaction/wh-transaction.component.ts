
import { DatePipe } from '@angular/common';
import { Component, ElementRef, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatAutocompleteActivatedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Params, Router } from '@angular/router';
import * as moment from 'jalali-moment';
import { AnimationOptions } from 'ngx-lottie';
import { concat, debounceTime, filter, map, Observable, Subscription, tap } from 'rxjs';
import { DistributorCompanyService } from 'src/app/core/distributor-company.service';
import { DrugsService } from 'src/app/core/drugs.service';
import { GeneralsService } from 'src/app/core/generals.service';
import { NumberPipePipe } from 'src/app/core/number-pipe.pipe';
import { TabService } from 'src/app/core/tab.service';
import { UiService } from 'src/app/core/ui.service';
import { WarehouseService } from 'src/app/core/warehouse.service';
import { IDrugs } from 'src/app/models/drugs.model';
import { IWhConfig } from 'src/app/models/general.model';
import { IDistributorCompany, IWhStore, IWhTransactionDetails, IWhTransactionHeader } from 'src/app/models/WareHouse/wh-store.model';
import { StoreDrugComponent } from '../../dialog/store-drug/store-drug.component';
import { UserListDialogComponent } from '../../dialog/user-list-dialog/user-list-dialog.component';

@Component({
  selector: 'app-wh-transaction',
  templateUrl: './wh-transaction.component.html',
  providers: [TabService, DatePipe, NumberPipePipe],
  styleUrls: ['./wh-transaction.component.scss']
})
export class WhTransactionComponent implements OnInit {
  lottieOpt: AnimationOptions = {
    path: '/assets/lottie/data-no-drug.json'
  };
  isLoading = false

  transactionHeaderDetails: IWhTransactionHeader = <IWhTransactionHeader>{}
  transactionDrugDetails: IWhTransactionDetails = <IWhTransactionDetails>{}
  maskDatePickers = {
    guide: true,
    showMask: true,
    mask: [/\d/, /\d/, /\d/, /\d/, '/', /\d/, /\d/, '/', /\d/, /\d/],
  };
  transactionType: any[] = []
  detailsFormGroup!: FormGroup;
  headerFormGroup!: FormGroup;
  companyList: IDistributorCompany[] = []
  WhConfigList: IWhConfig = <IWhConfig>{}
  storeList: IWhStore[] = []
  transactionId: string | null = null
  // conditionals
  isHeaderCreated = false
  isOutMode = false
  isWhToWh = false
  isEditMode = false
  conFirmDialog = false
  isDraftMode = false
  // drug Search
  //......
  drugsList = new Observable<IDrugs[]>();
  _searchDrugObs?: Subscription;
  isCosmetic = false;
  __drugsList?: IDrugs[]
  _searchFormHqIsInProgress = true
  _canSearchFromHq = false
  searchDrugLoading = false;

  @ViewChild('boxCount') boxCount!: any;
  @ViewChild('addDrugInput') drugInput!: ElementRef;
  @ViewChild('trigger') autoComplete!: MatAutocompleteTrigger;
  //.....
  constructor(private dialog: MatDialog,
    private fb: FormBuilder,
    private companyService: DistributorCompanyService,
    private generalService: GeneralsService,
    private datePipe: DatePipe,
    private uiService: UiService,
    private numberPipe: NumberPipePipe,
    private transactionService: WarehouseService,
    private drugService: DrugsService,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) { }
  ngOnInit(): void {
    this.drugFilters();
    this.headerFilter();
    this.activatedRoute.queryParams.subscribe((params) => {
      if (params['categoryId']) {
        this.headerFormGroup.controls['categoryId'].setValue(+params['categoryId'])
        this.checkIsOutMode()
      }
      if (params['id']) {
        this.transactionId = params['id']
        this.checkIsEditMode()
      }
    })

    this.getBaseData()
  }


  //form init
  drugFilters(transactionDrugDetails = <IWhTransactionDetails>{}) {
    this.detailsFormGroup = this.fb.group({
      drugId: new FormControl(transactionDrugDetails.drug, this.isOutMode ? Validators.nullValidator : Validators.required),
      boxCount: new FormControl(transactionDrugDetails.boxCount ?? 0, Validators.required),
      perBoxCount: new FormControl(transactionDrugDetails.perBoxCount ?? 0, this.isOutMode ? Validators.nullValidator : Validators.required),
      portionCount: new FormControl(transactionDrugDetails.portionCount ?? 0, this.isOutMode ? Validators.nullValidator : Validators.required),
      calculatedAmount: new FormControl(transactionDrugDetails.calculatedAmount),
      buyPrice: new FormControl(transactionDrugDetails.buyPrice, Validators.required),
      sellPrice: new FormControl(transactionDrugDetails.sellPrice, Validators.required),
      taxPrice: new FormControl(transactionDrugDetails.taxPrice),
      discountPrice: new FormControl(transactionDrugDetails.discountPrice ?? 0),
      discountPercent: new FormControl(transactionDrugDetails.discountPercent, Validators.max(100)),
      taxPercent: new FormControl(transactionDrugDetails.taxPercent, Validators.max(100)),
      isGift: new FormControl(transactionDrugDetails.isGift ?? false),
      expireDate: new FormControl(transactionDrugDetails.expireDate, Validators.required),
      batchId: new FormControl(transactionDrugDetails.batchId),
      settlementDeadLineDays: new FormControl(transactionDrugDetails.settlementDeadLineDays ?? 0),
      isValidItem: new FormControl(transactionDrugDetails.isValidItem),
      address: new FormControl(transactionDrugDetails.address, Validators.max(999)),
      row: new FormControl(transactionDrugDetails.address ? transactionDrugDetails.address.split(',')[0] : 0, Validators.max(999)),
      shelf: new FormControl(transactionDrugDetails.address ? transactionDrugDetails.address.split(',')[1] : 0, Validators.max(999)),
      floor: new FormControl(transactionDrugDetails.address ? transactionDrugDetails.address.split(',')[2] : 0, Validators.max(99)),
      payable: new FormControl(transactionDrugDetails.payable, Validators.required),
      description: new FormControl(transactionDrugDetails.description ?? ''),
    });
    this.updateEventDrugSearch()
  }
  headerFilter(transactionHeaderDetails = <IWhTransactionHeader>{}) {
    this.headerFormGroup = this.fb.group({
      categoryId: new FormControl(transactionHeaderDetails.categoryId, Validators.required),
      whStoreId: new FormControl(transactionHeaderDetails.whStoreId, Validators.required),
      factorNo: new FormControl(transactionHeaderDetails.factorNo, Validators.required),
      settlementDeadLineDays: new FormControl(transactionHeaderDetails.settlementDeadLineDays, Validators.required),
      factorDate: new FormControl(transactionHeaderDetails.factorDate, Validators.required),
      deliverDate: new FormControl(transactionHeaderDetails.deliverDate, Validators.required),
      createDate: new FormControl({ value: transactionHeaderDetails.createDate, disabled: true }, Validators.required),
      discountPrice: new FormControl(transactionHeaderDetails.discountPrice),
      discountPercent: new FormControl(transactionHeaderDetails.discountPercent, Validators.max(100)),
      taxPrice: 0,
      taxPercent: 0,
      description: new FormControl(transactionHeaderDetails.description),
      distributorInfo: new FormControl({ value: transactionHeaderDetails.distributorInfo, disabled: transactionHeaderDetails.distributorUserId ? true : false }, Validators.required),
      distributorCompanyId: new FormControl(transactionHeaderDetails.distributorCompanyId),
      receiverInfo: new FormControl({ value: transactionHeaderDetails.receiverInfo, disabled: transactionHeaderDetails.receiverUserId ? true : false }, Validators.required),
      distributorUserId: new FormControl(transactionHeaderDetails.distributorUserId),
      destinationStoreId: new FormControl(transactionHeaderDetails.destinationStoreId, this.isWhToWh ? Validators.required : Validators.nullValidator),
      receiverUserId: new FormControl(transactionHeaderDetails.receiverUserId),
      // transactionNo: new FormControl(transactionHeaderDetails.transactionNo),
      statusId: new FormControl(transactionHeaderDetails.statusId ? transactionHeaderDetails.statusId : 0),
    })
    this.headerFormGroup.updateValueAndValidity()
    this.updateEventCategorySearch()
    if (transactionHeaderDetails?.statusId == 1 || this.isDraftMode == true) {
      this.headerFormGroup.controls['categoryId'].disable()
    }
    if (transactionHeaderDetails?.statusId == 2) {
      this.headerFormGroup.controls['whStoreId'].disable()
      this.headerFormGroup.controls['categoryId'].disable()
    }

  }

  //autoComplate
  updateEventCategorySearch() {
    this.headerFormGroup
      .get('categoryId')!
      .valueChanges
      .subscribe((text: string) => {
        this.checkIsOutMode()
      });
  }
  updateEventDrugSearch() {
    this.detailsFormGroup
      .get('drugId')!
      .valueChanges.pipe(
        debounceTime(350),
        tap((res) => {
          if (res == null) return;
          if (res?.id || res?.isEmpty) return;
          if (res.length == 0) {
            this.__drugsList = undefined;
            this.searchDrugLoading = false;
          }
          this._canSearchFromHq = false
        }),
        filter((res) => res?.length > 0),
        //distinctUntilChanged()
      )
      .subscribe((text: string) => {
        if (
          this.detailsFormGroup.controls['drugId'].value.length > 0
        ) {
          this.searchDrugs(text, false)
        }
      });
  }

  // get date
  getBaseData() {
    this.generalService.getConfig().subscribe((res) => {
      res.whConfig.transactionCategories = res.whConfig.transactionCategories.filter(x => x.id != 10)
      this.WhConfigList = res.whConfig
    })
    this.getDistributorCompanyList()
    this.getStoreList()
  }
  getDistributorCompanyList() {
    this.isLoading = true
    this.companyService.getDistributorCompanyList().subscribe((res) => {
      this.companyList = res
      this.isLoading = false
    })
  }
  getStoreList() {
    this.isLoading = true
    this.transactionService.getstoreList().subscribe((res) => {
      this.storeList = res
      this.isLoading = false

    })
  }


  // drug 
  drugSearchOptionActivated(e: MatAutocompleteActivatedEvent) {
    if (
      !e.option ||
      !e.option?.value?.toString().includes('  __HQ__  ')
    ) return

    this.searchDrugs(this.detailsFormGroup.controls['drugId'].value, true)
  }

  searchDrugs(q: string, fromHq: boolean) {
    if (q.includes('  __HQ__  ')) {
      q = q.replace('  __HQ__  ', '')
      fromHq = true
    }
    if (!q) {
      this.__drugsList = undefined
      return
    }
    if (this.searchDrugLoading) return
    this.searchDrugLoading = true
    if (fromHq) this._searchFormHqIsInProgress = true

    this._searchDrugObs?.unsubscribe();
    var storeId = this.headerFormGroup.controls['whStoreId'].value
    if (!storeId) {
      this.uiService.showError('لطفا انبار را انتخاب کنید')
      return
    }
    this._searchDrugObs = this.drugService
      .searchDrug({
        query: q.trim(),
        ignorePharmacyDrugs: false,
        isCosmetic: this.isCosmetic,
        deleted: false,
        WhStoreId: storeId,
        fetchFromHq: fromHq,
      }).subscribe(res => {
        this.searchDrugLoading = false;
        this._searchFormHqIsInProgress = false
        if (fromHq) {
          this._canSearchFromHq = false
          res.forEach(element => {
            if (!this.__drugsList?.find(x => x.id == element.id)) {
              if (!this.__drugsList) this.__drugsList = []
              this.__drugsList?.push(element)
            }
          });
          return
        }
        if (res.length > 0)
          this.__drugsList = res
        else
          this.__drugsList = undefined
        this._canSearchFromHq = true
      }, err => {
        this._canSearchFromHq = true
        this.searchDrugLoading = false;
        this._searchFormHqIsInProgress = false

      })
  }

  getDrugName(drug: any): string {
    var res = '';
    if (drug && drug?.id) {
      res = '';
      res += drug.title + ' ';
      res += drug ? drug.dosageFa + ' ' : '';
      res += drug ? drug.factory : ' ';
    }
    else {
      if (drug)
        if (drug.includes('  __HQ__  ')) {
          res = drug.replace('  __HQ__  ', '')
        }
    }
    return res;
  }

  getDrugById(drugId: string, isAddMode: boolean = false) {
    this.isLoading = true
    this.drugService.getDrug(drugId).subscribe(res => {
      this.transactionDrugDetails.drug = res
      if (isAddMode) {
        if (!this.transactionDrugDetails.drug?.inLocalDb) this.attachDrug(this.transactionDrugDetails.drug!)
        this.checkDrugConditions()
      }
      this.drugFilters(this.transactionDrugDetails);

    })
  }

  attachDrug(drg: IDrugs) {
    this.drugService.attachDrugs(drg).subscribe()
  }


  //dialog
  openUserListDialog() {
    let dialogRef = this.dialog.open(UserListDialogComponent, {
      width: '350px',
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Refresh all list
        this.headerFormGroup.controls['receiverUserId'].setValue(result.id)
        this.headerFormGroup.controls['receiverInfo'].setValue(result.firstName + ' ' + result.lastName)
        this.headerFormGroup.controls['receiverInfo'].disable()
      }
    });
  }
  openDistributorUserListDialog() {
    let dialogRef = this.dialog.open(UserListDialogComponent, {
      width: '350px',
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Refresh all list

        this.headerFormGroup.controls['distributorUserId'].setValue(result.id)
        this.headerFormGroup.controls['distributorInfo'].setValue(result.firstName + ' ' + result.lastName)
        this.headerFormGroup.controls['distributorInfo'].disable()
      }
    });
  }
  openStoreDrugDialog() {
    if (!this.isOutMode) return
    var drug = this.detailsFormGroup.controls['drugId'].value
    var storeId = this.headerFormGroup.controls['whStoreId'].value
    if (!storeId) {
      this.uiService.showError('انبار را انتخاب کنید')
      return
    }
    let dialogRef = this.dialog.open(StoreDrugComponent, {
      width: '350px',
      data: { drug, storeId }
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.conFirmDialog = true
        const control1 = <FormControl>this.detailsFormGroup.get('calculatedAmount');
        this.detailsFormGroup.controls['batchId'].setValue(result.batchId)
        result.expireDate
        this.detailsFormGroup.controls['expireDate'].setValue(result.expireDate)
        this.detailsFormGroup.controls['buyPrice'].setValue(result.lastBuyPrice)
        this.detailsFormGroup.controls['sellPrice'].setValue(result.lastSellPrice)
        this.detailsFormGroup.controls['batchId'].disable()
        this.detailsFormGroup.controls['expireDate'].disable()
        control1.setValue(result.amount)
        control1.setValidators([Validators.max(result.amount)])
        this.detailsFormGroup.controls['portionCount'].setValue(result.amount)
        this.detailsFormGroup.controls['boxCount'].setValue(0)
        this.detailsFormGroup.controls['perBoxCount'].setValue(0)
        this.detailsFormGroup.controls['address'].setValue(result.address)
        this.detailsFormGroup.controls['row'].setValue(result.address ? result.address.split(',')[0] : 0)
        this.detailsFormGroup.controls['shelf'].setValue(result.address ? result.address.split(',')[1] : 0)
        this.detailsFormGroup.controls['floor'].setValue(result.address ? result.address.split(',')[2] : 0)

        control1.updateValueAndValidity()
        this.boxCount.nativeElement.focus()
        this.autoComplete.closePanel()
        setTimeout(() => {
          this.autoComplete.closePanel()
          this.boxCount.nativeElement.focus()
        }, 100);
      }
    });
  }

  // ui Stuff
  updateTable(item: IWhTransactionDetails) {
    this.transactionHeaderDetails.items?.forEach((drg) => {
      drg.isDrugEditMode = false
      if (drg == item) {
        drg.isDrugEditMode = true
        this.transactionDrugDetails = drg
      }
    })

    this.isLoading = false
    this.drugFilters(this.transactionDrugDetails)
    this.detailsFormGroup.controls['expireDate'].setValue(this.datePipe.transform(this.transactionDrugDetails.expireDate, 'yyyy-MM-dd'));

    if (this.isOutMode) {
      this.detailsFormGroup.controls['batchId'].disable()
      this.detailsFormGroup.controls['expireDate'].disable()
    }
  }

  clearTransaction() {
    this.drugFilters()
    this.headerFilter()
    this.isHeaderCreated = false
    this.isDraftMode = false
    this.isEditMode = false
    this.transactionHeaderDetails = <IWhTransactionHeader>{}
    this.transactionDrugDetails = <IWhTransactionDetails>{}
    this.headerFormGroup.enable()
    this.headerFormGroup.markAsPristine()
    this.detailsFormGroup.enable()
    this.detailsFormGroup.markAsPristine()
    this.headerFormGroup.controls['createDate'].disable()
    this.clearParam()
  }

  getTransactionHeaderFromUi() {
    // if (!this.isHeaderCreated) {
    var temp = this.transactionHeaderDetails.items
    var idTemp = this.transactionHeaderDetails.id
    this.transactionHeaderDetails = this.headerFormGroup.getRawValue()
    if (!this.isHeaderCreated)
      this.transactionHeaderDetails.items = []
    else {
      if (idTemp)
        this.transactionHeaderDetails.id = idTemp
      this.transactionHeaderDetails.items = temp
    }
    if (!this.transactionHeaderDetails.factorNo || this.transactionHeaderDetails.factorNo.length == 0) {
      this.transactionHeaderDetails.factorNo = '0'
    }
    if (!this.transactionHeaderDetails.discountPrice || this.transactionHeaderDetails.discountPrice.toString().length == 0) {
      this.transactionHeaderDetails.discountPrice = 0
    }
    this.isHeaderCreated = true
    // }
  }

  numericOnly(event: any): boolean {
    let pattern = /^([0-9.-])$/;
    let result = pattern.test(event.key);
    return result;
  }

  getDrugDetailsFromUi() {

    const tempId = this.transactionDrugDetails?.id
    const isDrugEditMode = this.transactionDrugDetails?.isDrugEditMode
    const updateStatus = this.transactionDrugDetails?.updateStatus
    this.transactionDrugDetails = this.detailsFormGroup.getRawValue()
    this.transactionDrugDetails.id = tempId
    this.transactionDrugDetails.isDrugEditMode = isDrugEditMode
    this.transactionDrugDetails.updateStatus = updateStatus
    if (!this.isOutMode) {
      // محاسبه ادرس دارو
      this.transactionDrugDetails.address = (this.transactionDrugDetails.row ? this.transactionDrugDetails.row.toString().padStart(3, '0') : '000') + ','
        + (this.transactionDrugDetails.shelf ? this.transactionDrugDetails.shelf.toString().padStart(3, '0') : '000') + ','
        + (this.transactionDrugDetails.floor ? this.transactionDrugDetails.floor.toString().padStart(2, '0') : '00')
    }
    // محاسبه تعداد
    this.transactionDrugDetails.calculatedAmount = (this.transactionDrugDetails.boxCount * this.transactionDrugDetails.perBoxCount) + this.transactionDrugDetails.portionCount
    this.detailsFormGroup.controls['calculatedAmount'].setValue((this.transactionDrugDetails.boxCount * this.transactionDrugDetails.perBoxCount) + this.transactionDrugDetails.portionCount)
    if (this.transactionDrugDetails.isGift == null) this.transactionDrugDetails.isGift = false
  }

  addDrugToTransaction() {
    if (!this.conFirmDialog && this.isOutMode) {
      this.uiService.showError("خطا دارو را انتخاب کنید ")
      return
    }

    this.isLoading = true
    this.updateValidators()
    this.getTransactionHeaderFromUi()
    this.getDrugDetailsFromUi()
    if (this.headerFormGroup.invalid) {
      this.isLoading = false
      this.uiService.showError('فرم هدر حواله را دوباره بررسی کنید')
      return
    }
    if (this.detailsFormGroup.invalid) {
      this.isLoading = false
      this.uiService.showError('فرم داروی حواله را دوباره بررسی کنید')
      if (this.isOutMode && this.detailsFormGroup.controls['calculatedAmount'].invalid) {
        this.uiService.showError('مقدار وارد شده از مقدار موجود در انبار بیشتر است')
      }
      return
    }

    this.headerFormGroup.controls['categoryId'].disable()

    //calculate DrugExpireDate
    const DrugExpireDate = this.detailsFormGroup.controls['expireDate'].value
    const year = DrugExpireDate.slice(0, 4)
    var date: any
    if (year > 2000) {
      date = new Date(DrugExpireDate);
    }
    else {
      date = moment.from(DrugExpireDate, 'fa', 'YYYY-MM-DD').format()
    }
    this.transactionDrugDetails.expireDate = date;

    if (this.detailsFormGroup.controls['drugId'].value.id) {
      this.transactionDrugDetails.drugId = this.detailsFormGroup.controls['drugId'].value.id
      this.transactionDrugDetails.drug = this.detailsFormGroup.controls['drugId'].value
      if (!this.transactionDrugDetails.drug?.inLocalDb) this.attachDrug(this.transactionDrugDetails.drug!)
      this.checkDrugConditions()
    }

    else this.isLoading = false


  }

  // transaction Api
  getTransactionById(id: string) {
    this.transactionService.getTransactionById(id).subscribe((res) => {
      this.transactionHeaderDetails = res
      if (this.transactionHeaderDetails.items)
        for (let index = 0; index < this.transactionHeaderDetails.items.length; index++) {
          if (this.transactionHeaderDetails.items[index].drug?.inLocalDb)
            this.transactionHeaderDetails.items[index].drug.inLocalDb = true;

        }
      if (this.transactionHeaderDetails.statusId == 1) this.isDraftMode = true;
      this.headerFilter(this.transactionHeaderDetails)
      this.checkIsOutMode()
    })
  }

  createTransaction(statusId: number) {
    this.transactionHeaderDetails.statusId = statusId

    this.isLoading = true
    this.transactionService.createTransaction(this.transactionHeaderDetails).subscribe((res) => {
      this.transactionHeaderDetails = res
      if (this.transactionHeaderDetails.items)
        for (let index = 0; index < this.transactionHeaderDetails.items.length; index++) {
          if (this.transactionHeaderDetails.items[index].drug?.inLocalDb)
            this.transactionHeaderDetails.items[index].drug.inLocalDb = true;
        }
      if (this.transactionHeaderDetails?.id) {
        if (statusId == 1) {
          this.isDraftMode = true
          this.openCreateTransaction(res.id)
        }
        if (statusId == 2)
          this.clearTransaction()
        this.isLoading = false
      }
    }, (err) => {
      this.isLoading = false
      this.uiService.showError(err.error.message)
    })
  }
  updateTransaction(registerMode = false, statusId?: number) {
    if (statusId)
      this.transactionHeaderDetails.statusId = statusId
    var _dirtyHeader = { ...this.transactionHeaderDetails }
    var _pristineHeader: any = []
    _dirtyHeader.items = []
    this.transactionHeaderDetails.items?.forEach((x) => {
      if (x.updateStatus != 0)
        _dirtyHeader.items?.push(x)
      else _pristineHeader.push(x)
    })
    this.isLoading = true
    this.transactionService.updateTransaction(_dirtyHeader).subscribe((res) => {
      this.isLoading = false
      this.transactionHeaderDetails = res
      if (this.transactionHeaderDetails.items)
        for (let index = 0; index < this.transactionHeaderDetails.items.length; index++) {
          if (this.transactionHeaderDetails.items[index].drug?.inLocalDb)
            this.transactionHeaderDetails.items[index].drug.inLocalDb = true;
        }
      if (this.transactionHeaderDetails.items)
        this.transactionHeaderDetails.items = [...this.transactionHeaderDetails.items, ..._pristineHeader]
      else this.transactionHeaderDetails.items = _pristineHeader

      if (registerMode) {
        this.clearTransaction()
      }
    }, (err) => {
      this.uiService.showError(err.error.message)
      this.isLoading = false
    })
  }



  checkDrugQuantity(transactionItem: IWhTransactionDetails, updateStatus: number) {
    if (transactionItem.updateStatus == 1 && updateStatus == 3) {
      this.transactionHeaderDetails.items = this.transactionHeaderDetails.items?.filter(x => x != transactionItem)
      return
    }
    if (!transactionItem.id || !this.transactionId) {
      this.checkDrugQuantityFunction(transactionItem, updateStatus)
      return
    }
    this.transactionDrugDetails.calculatedAmount = (this.transactionDrugDetails.boxCount * this.transactionDrugDetails.perBoxCount)
      + this.transactionDrugDetails.portionCount
    this.detailsFormGroup.controls['calculatedAmount'].setValue(this.transactionDrugDetails.calculatedAmount)
    if (this.detailsFormGroup.controls['calculatedAmount'].valid)
      this.transactionService.checkDrugQuantity({
        quantity: updateStatus == 3 ? 0 : this.transactionDrugDetails.calculatedAmount,
        transactionId: this.transactionId,
        transactionItemId: transactionItem.id
      }).subscribe((res) => {
        this.checkDrugQuantityFunction(transactionItem, updateStatus)
      }, (err) => {
        this.conFirmDialog = false

        this.uiService.showError(err.error.message)
        this.transactionDrugDetails.isValidItem = false
        this.detailsFormGroup.reset()
        this.drugInput.nativeElement.focus()
        this.isLoading = false
      })
    else {
      this.conFirmDialog = false

      this.isLoading = false
    }
  }

  //check conditions
  checkIsOutMode() {
    if (
      this.headerFormGroup.controls['categoryId'].value == 2 ||
      this.headerFormGroup.controls['categoryId'].value == 3 ||
    ) {
      this.isOutMode = true
      this.detailsFormGroup.controls['batchId'].enable()
      this.detailsFormGroup.controls['expireDate'].enable()
      if (this.headerFormGroup.controls['categoryId'].value == 3) {
        this.isWhToWh = true
      }
      else
        this.isWhToWh = false
    }
    else {
      this.detailsFormGroup.controls['batchId'].enable()
      this.detailsFormGroup.controls['expireDate'].enable()
      this.isOutMode = false
      this.isWhToWh = false
    }
    this.updateValidators()
  }

  updateValidators() {
    this.detailsFormGroup.controls['boxCount'].addValidators(Validators.required)
    this.detailsFormGroup.controls['perBoxCount'].addValidators(Validators.required)
    this.detailsFormGroup.controls['portionCount'].addValidators(Validators.required)
    this.detailsFormGroup.controls['boxCount'].updateValueAndValidity()
    this.detailsFormGroup.controls['perBoxCount'].updateValueAndValidity()
    this.detailsFormGroup.controls['portionCount'].updateValueAndValidity()
    this.detailsFormGroup.markAllAsTouched()
    this.headerFormGroup.markAllAsTouched()
  }

  checkIsEditMode() {
    if (this.transactionId) {
      this.isEditMode = true
      this.isHeaderCreated = true
      this.getTransactionById(this.transactionId)
    }
  }

  checkCreateMode(statusId: number) {
    if ((this.isDraftMode || this.isEditMode) && statusId == 1) {
      this.updateTransaction(false);
      return
    }
    if (!this.isDraftMode && !this.isEditMode) {
      this.createTransaction(statusId)
      return
    }
    if (statusId == 2) {
      this.updateTransaction(true, statusId);
      return
    }
  }

  // table functions
  cancelUpdateMode(item: IWhTransactionDetails) {
    this.transactionHeaderDetails.items?.map(x => {
      if (x.id == item.id) x.isDrugEditMode = false
    })
    this.transactionDrugDetails = <IWhTransactionDetails>{}
    this.drugFilters()
  }

  checkDrugConditions() {
    if (this.isOutMode) {
      if (this.transactionDrugDetails.isDrugEditMode)
        this.checkDrugQuantity(this.transactionDrugDetails, 2)
      else
        this.checkDrugQuantity(this.transactionDrugDetails, 1)
    }
    else if (this.isEditMode && this.transactionDrugDetails.isDrugEditMode) {
      this.checkDrugQuantity(this.transactionDrugDetails, 2)
    }
    else {
      var added = false
      if (this.transactionHeaderDetails.items)
        for (let index = 0; index < this.transactionHeaderDetails.items.length; index++) {
          if (this.transactionHeaderDetails.items[index].isDrugEditMode == true) {
            this.transactionHeaderDetails.items[index] = this.transactionDrugDetails
            if (this.transactionDrugDetails.updateStatus == 0)
              this.transactionDrugDetails.updateStatus = 2
            added = true
            this.transactionHeaderDetails.items[index].isDrugEditMode = false
          }
        }
      if (!added) {
        this.transactionDrugDetails.updateStatus = 1
        this.transactionHeaderDetails.items?.push(this.transactionDrugDetails)
      }
      this.isLoading = false
      this.conFirmDialog = false

      this.drugFilters()
    }

  }


  //param function
  clearParam() {
    this.router.navigate(
      ['.'],
      { relativeTo: this.activatedRoute, queryParams: {} }
    );
  }
  openCreateTransaction(id?: string) {
    const queryParams: Params = { id: id };
    this.router.navigate(['.'], {
      relativeTo: this.activatedRoute,
      queryParams: queryParams,
      queryParamsHandling: 'merge',
    });
  }


  calculateDrugPayable() {
    var payable
    const sellPrice = +this.detailsFormGroup.controls['sellPrice']?.value
    const buyPrice = +this.detailsFormGroup.controls['buyPrice']?.value
    const taxPercent = this.detailsFormGroup.controls['taxPercent'].value
    var taxPrice = +this.detailsFormGroup.controls['taxPrice']?.value
    const discountPercent = this.detailsFormGroup.controls['discountPercent'].value
    var discountPrice = +this.detailsFormGroup.controls['discountPrice']?.value
    const boxCount = this.detailsFormGroup.controls['boxCount'].value
    const perBoxCount = this.detailsFormGroup.controls['perBoxCount'].value
    const portionCount = this.detailsFormGroup.controls['portionCount'].value
    const calculatedAmount = (boxCount * perBoxCount) + portionCount
    this.detailsFormGroup.controls['calculatedAmount'].setValue(calculatedAmount)
    this.isOutMode ? payable = calculatedAmount * sellPrice : payable = calculatedAmount * buyPrice
    var basePrice = payable
    if (discountPercent != 0 && discountPercent) {
      payable -= basePrice * (discountPercent / 100)
      discountPrice = basePrice * (discountPercent / 100)
      this.detailsFormGroup.controls['discountPrice'].setValue(discountPrice)
      if (!Number.isNaN(discountPrice))
        this.detailsFormGroup.controls['discountPrice'].setValue(discountPrice)
    }
    else {
      if (!Number.isNaN(discountPrice))
        payable -= discountPrice
    }
    if (taxPercent != 0 && taxPercent) {
      taxPrice = payable * (taxPercent / 100)
      payable += payable * (taxPercent / 100)
      if (!Number.isNaN(taxPrice))
        this.detailsFormGroup.controls['taxPrice'].setValue(taxPrice)
    }
    else {
      if (!Number.isNaN(taxPrice))
        payable += taxPrice
    }
    var gift = this.detailsFormGroup.controls['isGift']?.value
    payable = this.numberPipe.transform(payable.toString())
    if (gift) {
      this.detailsFormGroup.controls['payable'].setValue(0)
    }
    else if (!Number.isNaN(payable))
      this.detailsFormGroup.controls['payable'].setValue(payable)
  }
  checkDrugQuantityFunction(transactionItem: IWhTransactionDetails, updateStatus: number) {
    this.conFirmDialog = false

    this.drugInput.nativeElement.focus()
    this.transactionDrugDetails.isValidItem = true
    this.isLoading = false
    if (updateStatus == 1) {
      this.transactionDrugDetails.updateStatus = updateStatus
      this.transactionHeaderDetails.items?.push(this.transactionDrugDetails)
    }
    if (updateStatus == 2 || updateStatus == 3) {
      if (transactionItem.updateStatus != 1)
        this.transactionDrugDetails.updateStatus = updateStatus
      if (this.transactionHeaderDetails.items)
        for (let index = 0; index < this.transactionHeaderDetails.items.length; index++) {
          this.transactionHeaderDetails.items[index];
          if (this.transactionHeaderDetails.items[index].isDrugEditMode == true) {
            this.transactionHeaderDetails.items[index] = this.transactionDrugDetails
            this.transactionHeaderDetails.items[index].isDrugEditMode = false
          }
          if (this.transactionDrugDetails.updateStatus == 3) {
            this.transactionHeaderDetails.items[index].updateStatus = 3
          }
        }
    }
    this.drugFilters()
  }
}
