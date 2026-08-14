import { Table, Column, Model, DataType, Index } from 'sequelize-typescript';

@Table({
  tableName: 'Sessions',
  timestamps: false,
})
export class Session extends Model {
  @Index({
    name: 'sessions_phone_dataType_dataId_key',
    unique: true,
  })
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  phone: string;

  @Index({
    name: 'sessions_phone_dataType_dataId_key',
    unique: true,
  })
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  dataType: string;

  @Index({
    name: 'sessions_phone_dataType_dataId_key',
    unique: true,
  })
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  dataId: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  data: string;
}
